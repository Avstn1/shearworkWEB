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
  revenuePreserved: number  // Count of appointments where we preserved manual edits
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
  private appointmentsToUpsert: AppointmentWithValues[] = []
  private skippedNoClient: number = 0
  private tableName: string

  constructor(
    private supabase: SupabaseClient,
    private userId: string,
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
          revenue: null,  // Will be set after upsert if needed
          tip: null,      // Will be set after upsert if needed
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