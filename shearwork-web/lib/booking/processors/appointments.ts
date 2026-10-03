// lib/booking/processors/appointments.ts

import { SupabaseClient } from '@supabase/supabase-js'
import { chunk, fetchAllRows, fetchByIdChunks, IN_CHUNK_SIZE } from '../db'
import {
  NormalizedAppointment,
  ClientResolutionResult,
} from '../types'

const UPSERT_CHUNK_SIZE = 500

// ======================== TYPES ========================

export interface AppointmentUpsertRow {
  user_id: string
  acuity_appointment_id: string
  client_id: string
  phone_normalized: string | null
  appointment_date: string
  appointment_datecreated: string | null
  datetime: string
  service_type: string | null
  revenue: number | null
  tip: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface AppointmentProcessorResult {
  totalProcessed: number
  inserted: number
  updated: number
  skippedNoClient: number
  revenuePreserved: number  
}

interface AppointmentWithValues {
  row: AppointmentUpsertRow
  acuityRevenue: number
  acuityTip: number
}

/**
 * Options for AppointmentProcessor
 */
export interface AppointmentProcessorOptions {
  /** Table prefix for testing (e.g., 'test_' uses 'test_acuity_appointments') */
  tablePrefix?: string
}

// ======================== MAIN PROCESSOR ========================

export class AppointmentProcessor {
  private readonly appointmentsToUpsert: AppointmentWithValues[] = []
  private readonly appointmentIDsToDelete: [string, string | null][] = []
  private skippedNoClient: number = 0
  private readonly tableName: string

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly userId: string,
    options: AppointmentProcessorOptions = {}
  ) {
    const prefix = options.tablePrefix || ''
    this.tableName = `${prefix}acuity_appointments`
  }

  // ======================== PUBLIC METHODS ========================

  /**
   * Processes appointments and prepares them for upsert.
   * Links each appointment to its resolved client_id.
   * Does NOT write to database.
   */
  process(
    appointments: NormalizedAppointment[],
    clientResolution: ClientResolutionResult
  ): void {
    const now = new Date().toISOString()

    for (const appt of appointments) {
      const clientId = clientResolution.appointmentToClient.get(appt.externalId)

      // Canceled → delete only
      if (appt.canceled) {
        this.appointmentIDsToDelete.push([appt.externalId, clientId ?? null])
        continue
      }

      // Skip future appointments (including time in the same day) | datetime format 2026-01-15T08:30:00-0500
      const parseWithOffset = (dt: string) =>
      new Date(dt.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'))
      // After parsing: 2026-01-15T08:30:00-0500

      const nowParse = new Date()

      // Skip future appointments
      if (parseWithOffset(appt.datetime) > nowParse) {
        continue
      }

      if (!clientId) {
        this.skippedNoClient++
        continue
      }

      this.appointmentsToUpsert.push({
        row: {
          user_id: this.userId,
          acuity_appointment_id: appt.externalId,
          client_id: clientId,
          phone_normalized: appt.phoneNormalized,
          appointment_date: appt.date,
          datetime: appt.datetime,
          appointment_datecreated: appt.datetimeCreated,
          service_type: appt.serviceType,
          revenue: null,
          tip: null,
          notes: appt.notes,
          created_at: now,
          updated_at: now,
        },
        acuityRevenue: appt.price,
        acuityTip: appt.tip,
      })
    }
  }


  /**
   * Returns the upsert payload without writing to database.
   * Useful for testing and dry runs.
   */
  getUpsertPayload(): AppointmentUpsertRow[] {
    return this.appointmentsToUpsert.map(a => a.row)
  }

  /**
   * Returns appointments with their Acuity values (for testing).
   */
  getAppointmentsWithValues(): AppointmentWithValues[] {
    return this.appointmentsToUpsert
  }

  /**
   * Returns count of appointments skipped due to no client resolution.
   */
  getSkippedCount(): number {
    return this.skippedNoClient
  }

  /**
   * Returns the table name being used (for debugging/testing).
   */
  getTableName(): string {
    return this.tableName
  }

  /**
   * Upserts all processed appointments to the database.
   * 
   * Key behavior: Only sets revenue/tip for NEW appointments (where values are null).
   * This preserves any manual edits made to existing appointments.
   */
  async upsert(): Promise<AppointmentProcessorResult> {
    if (this.appointmentsToUpsert.length === 0) {
      return {
        totalProcessed: 0,
        inserted: 0,
        updated: 0,
        skippedNoClient: this.skippedNoClient,
        revenuePreserved: 0,
      }
    }

    // Build lookup for Acuity values by appointment ID
    const acuityValues: Record<string, { revenue: number; tip: number }> = {}
    for (const appt of this.appointmentsToUpsert) {
      acuityValues[appt.row.acuity_appointment_id] = {
        revenue: appt.acuityRevenue,
        tip: appt.acuityTip,
      }
    }

    // Prepare rows for upsert (without revenue/tip - we'll set those separately)
    const rowsToUpsert = this.appointmentsToUpsert.map(a => ({
      user_id: a.row.user_id,
      acuity_appointment_id: a.row.acuity_appointment_id,
      client_id: a.row.client_id,
      phone_normalized: a.row.phone_normalized,
      appointment_date: a.row.appointment_date,
      appointment_datecreated: a.row.appointment_datecreated,
      datetime: a.row.datetime,
      service_type: a.row.service_type,
      notes: a.row.notes,
      created_at: a.row.created_at,
      updated_at: a.row.updated_at,
    }))

    // Upsert appointments (without revenue/tip to preserve manual edits), in chunks so a
    // year of appointments doesn't become one oversized request
    const upsertedAppts: Array<{ id: string; acuity_appointment_id: string; tip: number | null; revenue: number | null }> = []
    for (const rows of chunk(rowsToUpsert, UPSERT_CHUNK_SIZE)) {
      const { data, error: upsertError } = await this.supabase
        .from(this.tableName)
        .upsert(rows, { onConflict: 'user_id,acuity_appointment_id' })
        .select('id, acuity_appointment_id, tip, revenue')

      if (upsertError) {
        console.error('Appointment upsert error:', upsertError)
        throw upsertError
      }
      upsertedAppts.push(...(data ?? []))
    }

    // Delete canceled appointments from the database

    // if (this.appointmentIDsToDelete.length > 0) {
    //   console.log('Deleting canceled appointments...')
    //   const { data: deletedRows, error: deleteError } = await this.supabase
    //     .from(this.tableName)
    //     .delete()
    //     .eq('user_id', this.userId)
    //     .in('acuity_appointment_id', this.appointmentIDsToDelete)
    //     .select()

    //   if (deleteError) {
    //     throw deleteError
    //   }

    //   console.log('Deleted rows:', deletedRows)
    //   console.log('Number of rows deleted:', deletedRows?.length || 0)
    // }

    if (this.appointmentIDsToDelete.length > 0) {
      await this.removeCanceledAppointments(
        this.appointmentIDsToDelete.map(([apptId]) => apptId)
      )
    }

    let inserted = 0
    let updated = 0
    let revenuePreserved = 0

    if (upsertedAppts && upsertedAppts.length > 0) {
      // Find appointments that need revenue/tip set (new appointments with null values)
      const needsValues = upsertedAppts.filter(
        appt => appt.revenue === null || appt.tip === null
      )

      // These are truly new appointments
      inserted = needsValues.length
      
      // These had existing values (manual edits preserved)
      revenuePreserved = upsertedAppts.length - needsValues.length
      updated = revenuePreserved

      // Fill revenue/tip only where they are still empty (manual edits are kept), as one
      // bulk upsert instead of an UPDATE per appointment
      const rowByAppointmentId = new Map(rowsToUpsert.map(row => [row.acuity_appointment_id, row]))
      const fills = needsValues.flatMap(appt => {
        const values = acuityValues[appt.acuity_appointment_id]
        const row = rowByAppointmentId.get(appt.acuity_appointment_id)
        if (!values || !row) return []
        return [{
          ...row,
          revenue: appt.revenue ?? values.revenue,
          tip: appt.tip ?? values.tip,
        }]
      })

      for (const rows of chunk(fills, UPSERT_CHUNK_SIZE)) {
        const { error: updateError } = await this.supabase
          .from(this.tableName)
          .upsert(rows, { onConflict: 'user_id,acuity_appointment_id' })

        if (updateError) {
          console.error('Failed to set revenue/tip on new appointments:', updateError)
          throw updateError
        }
      }
    }

    return {
      totalProcessed: this.appointmentsToUpsert.length,
      inserted,
      updated,
      skippedNoClient: this.skippedNoClient,
      revenuePreserved,
    }
  }

  /**
   * Deletes canceled/no-show appointments, then fixes up their clients in bulk:
   * clients with no appointments left are removed, the rest get a fresh
   * total_appointments and last_appt.
   */
  private async removeCanceledAppointments(appointmentIds: string[]): Promise<void> {
    const clientsTable = this.tableName.replace('acuity_appointments', 'acuity_clients')

    const affectedClientIds = new Set<string>()
    for (const ids of chunk(appointmentIds, IN_CHUNK_SIZE)) {
      const { data: deletedRows, error: deleteError } = await this.supabase
        .from(this.tableName)
        .delete()
        .eq('user_id', this.userId)
        .in('acuity_appointment_id', ids)
        .select('client_id')

      if (deleteError) throw deleteError
      for (const row of deletedRows ?? []) {
        if (row.client_id) affectedClientIds.add(row.client_id)
      }
    }

    if (affectedClientIds.size === 0) return

    // Remaining appointments for every affected client, in one paged read per chunk
    const remaining = await fetchByIdChunks(Array.from(affectedClientIds), idChunk =>
      fetchAllRows<{ client_id: string; appointment_date: string }>((from, to) =>
        this.supabase
          .from(this.tableName)
          .select('client_id, appointment_date, id')
          .eq('user_id', this.userId)
          .in('client_id', idChunk)
          .order('id')
          .range(from, to)
      )
    )

    const stats = new Map<string, { count: number; lastAppt: string | null }>()
    for (const row of remaining) {
      const current = stats.get(row.client_id) ?? { count: 0, lastAppt: null }
      current.count += 1
      if (row.appointment_date && (!current.lastAppt || row.appointment_date > current.lastAppt)) {
        current.lastAppt = row.appointment_date
      }
      stats.set(row.client_id, current)
    }

    const emptyClients = Array.from(affectedClientIds).filter(id => !stats.has(id))
    for (const ids of chunk(emptyClients, IN_CHUNK_SIZE)) {
      const { error } = await this.supabase
        .from(clientsTable)
        .delete()
        .eq('user_id', this.userId)
        .in('client_id', ids)
      if (error) console.error('Error deleting clients without appointments:', error)
    }

    const now = new Date().toISOString()
    await Promise.all(
      Array.from(stats.entries()).map(async ([clientId, { count, lastAppt }]) => {
        const { error } = await this.supabase
          .from(clientsTable)
          .update({ total_appointments: count, last_appt: lastAppt, updated_at: now })
          .eq('client_id', clientId)
          .eq('user_id', this.userId)
        if (error) console.error('Error updating client:', clientId, error)
      })
    )
  }

}