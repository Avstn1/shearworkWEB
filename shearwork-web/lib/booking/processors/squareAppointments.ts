import { SupabaseClient } from '@supabase/supabase-js'
import {
  NormalizedAppointment,
  ClientResolutionResult,
} from '../types'

export interface SquareAppointmentUpsertRow {
  user_id: string
  merchant_id: string
  location_id: string | null
  square_booking_id: string
  customer_id: string
  phone_normalized: string | null
  appointment_date: string
  datetime: string
  revenue: number | null
  tip: number | null
  service_type: string | null
  team_member_id: string | null
  order_id: string | null
  payment_id: string | null
  status: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface SquareAppointmentProcessorResult {
  totalProcessed: number
  inserted: number
  updated: number
  skippedNoClient: number
  revenuePreserved: number
}

interface SquareAppointmentWithValues {
  row: SquareAppointmentUpsertRow
  revenue: number
  tip: number
}

interface SquareAppointmentProcessorOptions {
  tablePrefix?: string
  merchantId: string
}

export class SquareAppointmentProcessor {
  private appointmentsToUpsert: SquareAppointmentWithValues[] = []
  private skippedNoClient = 0
  private tableName: string

  constructor(
    private supabase: SupabaseClient,
    private userId: string,
    private options: SquareAppointmentProcessorOptions
  ) {
    const prefix = options.tablePrefix || ''
    this.tableName = `${prefix}square_appointments`
  }

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
          merchant_id: this.options.merchantId,
          location_id: appt.locationId || null,
          square_booking_id: appt.externalId,
          customer_id: clientId,
          phone_normalized: appt.phoneNormalized,
          appointment_date: appt.date,
          datetime: appt.datetime,
          revenue: null,
          tip: null,
          service_type: appt.serviceType,
          team_member_id: appt.teamMemberId || null,
          order_id: appt.orderId || null,
          payment_id: appt.paymentId || null,
          status: appt.status || null,
          notes: appt.notes,
          created_at: now,
          updated_at: now,
        },
        revenue: appt.price,
        tip: appt.tip,
      })
    }
  }

  getUpsertPayload(): SquareAppointmentUpsertRow[] {
    return this.appointmentsToUpsert.map((appt) => appt.row)
  }

  getSkippedCount(): number {
    return this.skippedNoClient
  }

  async upsert(): Promise<SquareAppointmentProcessorResult> {
    if (this.appointmentsToUpsert.length === 0) {
      return {
        totalProcessed: 0,
        inserted: 0,
        updated: 0,
        skippedNoClient: this.skippedNoClient,
        revenuePreserved: 0,
      }
    }

    const valuesByBookingId: Record<string, { revenue: number; tip: number }> = {}
    for (const appt of this.appointmentsToUpsert) {
      valuesByBookingId[appt.row.square_booking_id] = {
        revenue: appt.revenue,
        tip: appt.tip,
      }
    }

    const rowsToUpsert = this.appointmentsToUpsert.map((appt) => ({
      user_id: appt.row.user_id,
      merchant_id: appt.row.merchant_id,
      location_id: appt.row.location_id,
      square_booking_id: appt.row.square_booking_id,
      customer_id: appt.row.customer_id,
      phone_normalized: appt.row.phone_normalized,
      appointment_date: appt.row.appointment_date,
      datetime: appt.row.datetime,
      service_type: appt.row.service_type,
      team_member_id: appt.row.team_member_id,
      order_id: appt.row.order_id,
      payment_id: appt.row.payment_id,
      status: appt.row.status,
      notes: appt.row.notes,
      created_at: appt.row.created_at,
      updated_at: appt.row.updated_at,
    }))

    const { data: upserted, error: upsertError } = await this.supabase
      .from(this.tableName)
      .upsert(rowsToUpsert, { onConflict: 'user_id,square_booking_id' })
      .select('id, square_booking_id, revenue, tip, manually_edited')

    if (upsertError) {
      console.error('Square appointment upsert error:', upsertError)
      throw upsertError
    }

    const updateTargets = (upserted || []).filter((appt) => !appt.manually_edited)
    const insertedTargets = updateTargets.filter(
      (appt) => appt.revenue === null && appt.tip === null
    )

    for (const appt of updateTargets) {
      const values = valuesByBookingId[appt.square_booking_id]
      if (!values) continue

      const updates = {
        revenue: values.revenue,
        tip: values.tip,
      }

      const { error } = await this.supabase
        .from(this.tableName)
        .update(updates)
        .eq('id', appt.id)

      if (error) {
        console.error(`Failed to update square appointment ${appt.id}:`, error)
      }
    }

    return {
      totalProcessed: this.appointmentsToUpsert.length,
      inserted: insertedTargets.length,
      updated: updateTargets.length - insertedTargets.length,
      skippedNoClient: this.skippedNoClient,
      revenuePreserved: (upserted?.length || 0) - updateTargets.length,
    }
  }
}
