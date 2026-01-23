// lib/booking/processors/appointments.ts

import { SupabaseClient } from '@supabase/supabase-js'
import {
  NormalizedAppointment,
  ClientResolutionResult,
} from '../types'

// ======================== TYPES ========================

export interface AppointmentUpsertRow {
  user_id: string
  acuity_appointment_id: string
  client_id: string
  phone_normalized: string | null
  appointment_date: string
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
      datetime: a.row.datetime,
      service_type: a.row.service_type,
      notes: a.row.notes,
      created_at: a.row.created_at,
      updated_at: a.row.updated_at,
    }))

    // Upsert appointments (without revenue/tip to preserve manual edits)
    const { data: upsertedAppts, error: upsertError } = await this.supabase
      .from(this.tableName)
      .upsert(rowsToUpsert, { onConflict: 'user_id,acuity_appointment_id' })
      .select('id, acuity_appointment_id, tip, revenue')

    if (upsertError) {
      console.error('Appointment upsert error:', upsertError)
      throw upsertError
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
      // Extract just the appointment IDs for the query
      const appointmentIds = this.appointmentIDsToDelete.map(([apptId]) => apptId)
      
      // First, check what actually exists in the database
      const { data: existingRows, error: checkError } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('user_id', this.userId)
        .in('acuity_appointment_id', appointmentIds)

      if (checkError) {
        // console.log('Error checking existing appointments for deletion:', checkError)
      }

      if (existingRows && existingRows.length > 0) {
        const { data: deletedRows, error: deleteError } = await this.supabase
          .from(this.tableName)
          .delete()
          .eq('user_id', this.userId)
          .in('acuity_appointment_id', appointmentIds)
          .select()

        if (deleteError) {
          throw deleteError
        }

        // console.log('Deleted rows:', deletedRows)
        // console.log('Number of rows deleted:', deletedRows?.length || 0)

        // Now handle client updates/deletions
        const clientIds = new Set(deletedRows.map(row => row.client_id).filter(Boolean))
        
        for (const clientId of clientIds) {
          // Count remaining appointments for this client
          const { count, error: countError } = await this.supabase
            .from(this.tableName)
            .select('*', { count: 'exact', head: true })
            .eq('user_id', this.userId)
            .eq('client_id', clientId)

          if (countError) {
            console.error('Error counting appointments for client:', clientId, countError)
            continue
          }

          if (count === 0) {
            // Delete the client entirely
            const { error: deleteClientError } = await this.supabase
              .from('acuity_clients')
              .delete()
              .eq('client_id', clientId)
              .eq('user_id', this.userId)

            if (deleteClientError) {
              console.error('Error deleting client:', clientId, deleteClientError)
            } else {
              // console.log('Deleted client:', clientId)
            }
          } else {
            // Update total_appointments and potentially last_appt
            const { data: clientData, error: clientFetchError } = await this.supabase
              .from('acuity_clients')
              .select('last_appt')
              .eq('client_id', clientId)
              .eq('user_id', this.userId)
              .single()

            if (clientFetchError) {
              console.error('Error fetching client data:', clientId, clientFetchError)
              continue
            }

            // Get the most recent appointment for this client
            const { data: latestAppt, error: latestApptError } = await this.supabase
              .from(this.tableName)
              .select('appointment_date')
              .eq('user_id', this.userId)
              .eq('client_id', clientId)
              .order('appointment_date', { ascending: false })
              .limit(1)
              .single()

            if (latestApptError) {
              console.error('Error fetching latest appointment:', clientId, latestApptError)
              continue
            }

            const updateData: any = {
              total_appointments: count,
              updated_at: new Date().toISOString(),
            }

            // Update last_appt if it changed
            if (latestAppt && latestAppt.appointment_date !== clientData.last_appt) {
              updateData.last_appt = latestAppt.appointment_date
            }

            const { error: updateClientError } = await this.supabase
              .from('acuity_clients')
              .update(updateData)
              .eq('client_id', clientId)
              .eq('user_id', this.userId)

            if (updateClientError) {
              console.error('Error updating client:', clientId, updateClientError)
            } else {
              // console.log('Updated client:', clientId, updateData)
            }
          }
        }
      } else {
        // console.log('No matching rows found to delete')
      }
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

      // Set revenue/tip only for new appointments
      for (const appt of needsValues) {
        const values = acuityValues[appt.acuity_appointment_id]
        if (!values) continue

        const updates: { tip?: number; revenue?: number } = {}

        if (appt.tip === null) {
          updates.tip = values.tip
        }
        if (appt.revenue === null) {
          updates.revenue = values.revenue
        }

        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await this.supabase
            .from(this.tableName)
            .update(updates)
            .eq('id', appt.id)

          if (updateError) {
            console.error(`Failed to update appointment ${appt.id}:`, updateError)
          }
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
}