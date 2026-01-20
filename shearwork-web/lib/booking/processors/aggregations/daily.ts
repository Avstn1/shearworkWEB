// lib/booking/processors/aggregations/daily.ts

import { PullContext, AggregationResult } from '../../types'
import { OrchestratorOptions, pullOptionsToDateRange } from '../../orchestrator'
import { validateDateRange } from './shared/utils'

// Upserts to daily_data
export async function runDailyAggregation(
  context: PullContext,
  orchestratorOptions: OrchestratorOptions = {}
): Promise<AggregationResult> {
  const { supabase, userId, options } = context
  const { tablePrefix = '' } = orchestratorOptions
  
  const dateRange = pullOptionsToDateRange(options)
  const tableName = `${tablePrefix}daily_data`
  
  validateDateRange(dateRange.startISO, dateRange.endISO)
  
  try {
    const includeSquare = tablePrefix === ''

    const { data: acuityAppointments, error: acuityError } = await supabase
      .from(`${tablePrefix}acuity_appointments`)
      .select('appointment_date, revenue, tip')
      .eq('user_id', userId)
      .gte('appointment_date', dateRange.startISO)
      .lte('appointment_date', dateRange.endISO)

    if (acuityError) throw acuityError

    const { data: squareAppointments, error: squareError } = includeSquare
      ? await supabase
        .from('square_appointments')
        .select('appointment_date, revenue, tip, order_id, payment_id')
        .eq('user_id', userId)
        .gte('appointment_date', dateRange.startISO)
        .lte('appointment_date', dateRange.endISO)
      : { data: [], error: null }

    if (squareError) throw squareError

    const appointments = [
      ...(acuityAppointments || []).map((appt) => ({
        appointment_date: appt.appointment_date,
        revenue: appt.revenue || 0,
        tip: appt.tip || 0,
        order_id: null as string | null,
      })),
      ...(squareAppointments || []).map((appt) => ({
        appointment_date: appt.appointment_date,
        revenue: appt.revenue || 0,
        tip: appt.tip || 0,
        order_id: appt.order_id as string | null,
      })),
    ]

    const matchedOrderIds = new Set(
      (squareAppointments || [])
        .map((appt) => appt.order_id)
        .filter(Boolean) as string[]
    )

    const matchedPaymentIds = new Set(
      (squareAppointments || [])
        .map((appt) => appt.payment_id)
        .filter(Boolean) as string[]
    )

    const { data: squarePayments, error: paymentError } = includeSquare
      ? await supabase
        .from('square_payments')
        .select('payment_id, appointment_date, amount_total, tip_amount, order_id, status')
        .eq('user_id', userId)
        .eq('status', 'COMPLETED')
        .gte('appointment_date', dateRange.startISO)
        .lte('appointment_date', dateRange.endISO)
      : { data: [], error: null }

    if (paymentError) throw paymentError

    if (appointments.length === 0 && (!squarePayments || squarePayments.length === 0)) {
      return {
        table: tableName,
        rowsUpserted: 0,
      }
    }

    // Group by day in JavaScript
    const dailyStats = new Map<string, {
      date: string
      num_appointments: number
      total_revenue: number
      tips: number
      year: number
      month: string
    }>()

    const MONTHS = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]

    for (const appt of appointments) {
      const date = appt.appointment_date
      if (!dailyStats.has(date)) {
        const dateObj = new Date(date + 'T00:00:00')
        
        dailyStats.set(date, {
          date,
          num_appointments: 0,
          total_revenue: 0,
          tips: 0,
          year: dateObj.getUTCFullYear(),
          month: MONTHS[dateObj.getUTCMonth()]
        })
      }

      const stats = dailyStats.get(date)!
      stats.num_appointments++
      stats.total_revenue += appt.revenue || 0
      stats.tips += appt.tip || 0
    }

    for (const payment of squarePayments || []) {
      const date = payment.appointment_date
      if (!date) continue
      if (payment.order_id && matchedOrderIds.has(payment.order_id)) continue
      if (payment.payment_id && matchedPaymentIds.has(payment.payment_id)) continue

      if (!dailyStats.has(date)) {
        const dateObj = new Date(date + 'T00:00:00')

        dailyStats.set(date, {
          date,
          num_appointments: 0,
          total_revenue: 0,
          tips: 0,
          year: dateObj.getUTCFullYear(),
          month: MONTHS[dateObj.getUTCMonth()]
        })
      }

      const stats = dailyStats.get(date)!
      stats.total_revenue += Number(payment.amount_total) || 0
      stats.tips += Number(payment.tip_amount) || 0
    }

    // Convert to upsert payload matching your schema
    const upsertData = Array.from(dailyStats.values()).map(stats => ({
      user_id: userId,
      date: stats.date,
      year: stats.year,
      month: stats.month,
      num_appointments: stats.num_appointments,
      total_revenue: stats.total_revenue,
      tips: stats.tips,
      final_revenue: stats.total_revenue + stats.tips, // maybe remove expenses too?
      expenses: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }))

    // Upsert to daily_data
    if (upsertData.length > 0) {
      const { error: upsertError } = await supabase
        .from(tableName)
        .upsert(upsertData, {
          onConflict: 'user_id,date'
        })

      if (upsertError) throw upsertError
    }

    return {
      table: tableName,
      rowsUpserted: upsertData.length
    }

  } catch (err: any) {
    throw new Error(`${tableName} aggregation failed: ${err.message}`)
  }
}