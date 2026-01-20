// lib/booking/processors/aggregations/weekly.ts

import { PullContext, AggregationResult } from '../../types'
import { OrchestratorOptions, pullOptionsToDateRange } from '../../orchestrator'
import { validateDateRange, getMondayOfWeek, getSundayOfWeek, formatISODate } from './shared/utils'

export async function runWeeklyAggregation(
  context: PullContext,
  orchestratorOptions: OrchestratorOptions = {}
): Promise<AggregationResult[]> {
  const [weeklyData, topClients, marketingFunnels] = await Promise.all([
    aggregateWeeklyData(context, orchestratorOptions),
    aggregateWeeklyTopClients(context, orchestratorOptions),
    aggregateWeeklyMarketingFunnels(context, orchestratorOptions)
  ])
  
  return [weeklyData, topClients, marketingFunnels]
}

/**
 * Aggregate weekly_data table
 */
async function aggregateWeeklyData(
  context: PullContext,
  orchestratorOptions: OrchestratorOptions = {}
): Promise<AggregationResult> {
  const { supabase, userId, options } = context
  const { tablePrefix = '' } = orchestratorOptions
  
  const dateRange = pullOptionsToDateRange(options)

  // Table prefix is for testng. Example: '' for production, 'test_' for testing
  const tableName = `${tablePrefix}weekly_data`
  
  validateDateRange(dateRange.startISO, dateRange.endISO)

  const { data: squareToken } = await supabase
      .from('square_tokens')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    
  // Future-proofed for other booking softwares. Instead of doing this, add a column in the profiles table that specifies the booking software.
  const booking_software = squareToken?.user_id ? 'square' : 'acuity';
  const useAcuity = booking_software === 'acuity'
  const useSquare = booking_software === 'square'
  
  try {
    const { data: acuityAppointments, error: acuityError } = useAcuity ? await supabase
      .from(`${tablePrefix}acuity_appointments`)
      .select('appointment_date, revenue, tip, client_id')
      .eq('user_id', userId)
      .gte('appointment_date', dateRange.startISO)
      .lte('appointment_date', dateRange.endISO)
      : { data: [], error: null }

    if (acuityError) throw acuityError

    const { data: squareAppointments, error: squareError } = useSquare
      ? await supabase
        .from('square_appointments')
        .select('appointment_date, revenue, tip, customer_id, order_id, payment_id')
        .eq('user_id', userId)
        .gte('appointment_date', dateRange.startISO)
        .lte('appointment_date', dateRange.endISO)
      : { data: [], error: null }

    if (squareError) throw squareError

    const appointments = [
      ...(acuityAppointments || []).map((appt) => ({
        source: 'acuity',
        appointment_date: appt.appointment_date,
        revenue: appt.revenue || 0,
        tip: appt.tip || 0,
        client_id: appt.client_id,
      })),
      ...(squareAppointments || []).map((appt) => ({
        source: 'square',
        appointment_date: appt.appointment_date,
        revenue: appt.revenue || 0,
        tip: appt.tip || 0,
        client_id: appt.customer_id,
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

    const { data: squarePayments, error: paymentError } = useSquare
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
      return { table: tableName, rowsUpserted: 0 }
    }

    const acuityClientIds = [...new Set((acuityAppointments || []).map((a) => a.client_id))]
    const squareClientIds = [...new Set((squareAppointments || []).map((a) => a.customer_id))]

    const { data: acuityClients, error: acuityClientError } = acuityClientIds.length > 0
      ? await supabase
        .from(`${tablePrefix}acuity_clients`)
        .select('client_id, first_appt')
        .eq('user_id', userId)
        .in('client_id', acuityClientIds)
      : { data: [], error: null }

    if (acuityClientError) throw acuityClientError

    const { data: squareClients, error: squareClientError } =
      useSquare && squareClientIds.length > 0
        ? await supabase
          .from('square_clients')
          .select('customer_id, first_appt')
          .eq('user_id', userId)
          .in('customer_id', squareClientIds)
        : { data: [], error: null }

    if (squareClientError) throw squareClientError

    const clientMap = new Map<string, { first_appt: string | null }>()

    for (const client of acuityClients || []) {
      clientMap.set(`acuity:${client.client_id}`, client)
    }

    for (const client of squareClients || []) {
      clientMap.set(`square:${client.customer_id}`, client)
    }

    const weeklyStats = new Map<string, {
      weekStart: Date
      weekEnd: Date
      weekNumber: number
      month: string
      year: number
      num_appointments: number
      total_revenue: number
      tips: number
      newClients: Set<string>
      returningClients: Set<string>
    }>()

    const MONTHS = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]

    for (const appt of appointments) {
      const apptDate = new Date(appt.appointment_date + 'T00:00:00')
      const weekStart = getMondayOfWeek(apptDate)
      const weekEnd = getSundayOfWeek(weekStart)
      const weekKey = formatISODate(weekStart)

      if (!weeklyStats.has(weekKey)) {
        const weekNumber = Math.ceil(weekStart.getUTCDate() / 7)
        
        weeklyStats.set(weekKey, {
          weekStart,
          weekEnd,
          weekNumber,
          month: MONTHS[weekStart.getUTCMonth()],
          year: weekStart.getUTCFullYear(),
          num_appointments: 0,
          total_revenue: 0,
          tips: 0,
          newClients: new Set(),
          returningClients: new Set()
        })
      }

      const stats = weeklyStats.get(weekKey)!
      stats.num_appointments++
      stats.total_revenue += appt.revenue || 0
      stats.tips += appt.tip || 0

      const clientKey = `${appt.source}:${appt.client_id}`
      const client = clientMap.get(clientKey)
      if (client?.first_appt) {
        const firstApptDate = new Date(client.first_appt + 'T00:00:00')
        const firstApptWeekStart = getMondayOfWeek(firstApptDate)
        
        if (formatISODate(firstApptWeekStart) === weekKey) {
          stats.newClients.add(clientKey)
        } else {
          stats.returningClients.add(clientKey)
        }
      }
    }

    for (const payment of squarePayments || []) {
      const date = payment.appointment_date
      if (!date) continue
      if (payment.order_id && matchedOrderIds.has(payment.order_id)) continue
      if (payment.payment_id && matchedPaymentIds.has(payment.payment_id)) continue

      const apptDate = new Date(date + 'T00:00:00')
      const weekStart = getMondayOfWeek(apptDate)
      const weekEnd = getSundayOfWeek(weekStart)
      const weekKey = formatISODate(weekStart)

      if (!weeklyStats.has(weekKey)) {
        const weekNumber = Math.ceil(weekStart.getUTCDate() / 7)
        weeklyStats.set(weekKey, {
          weekStart,
          weekEnd,
          weekNumber,
          month: MONTHS[weekStart.getUTCMonth()],
          year: weekStart.getUTCFullYear(),
          num_appointments: 0,
          total_revenue: 0,
          tips: 0,
          newClients: new Set(),
          returningClients: new Set()
        })
      }

      const stats = weeklyStats.get(weekKey)!
      stats.total_revenue += Number(payment.amount_total) || 0
      stats.tips += Number(payment.tip_amount) || 0
    }

    const upsertData = Array.from(weeklyStats.values()).map(stats => ({
      user_id: userId,
      week_number: stats.weekNumber,
      start_date: formatISODate(stats.weekStart),
      end_date: formatISODate(stats.weekEnd),
      year: stats.year,
      month: stats.month,
      num_appointments: stats.num_appointments,
      total_revenue: stats.total_revenue,
      tips: stats.tips,
      expenses: 0,
      new_clients: stats.newClients.size,
      returning_clients: stats.returningClients.size,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }))

    if (upsertData.length > 0) {
      const { error: upsertError } = await supabase
        .from(tableName)
        .upsert(upsertData, {
          onConflict: 'user_id,week_number,month,year'
        })

      if (upsertError) throw upsertError
    }

    return { table: tableName, rowsUpserted: upsertData.length }

  } catch (err: any) {
    throw new Error(`${tableName} aggregation failed: ${err.message}`)
  }
}

/**
 * Aggregate weekly_top_clients table
 */
async function aggregateWeeklyTopClients(
  context: PullContext,
  orchestratorOptions: OrchestratorOptions = {}
): Promise<AggregationResult> {
  const { supabase, userId, options } = context
  const { tablePrefix = '' } = orchestratorOptions
  
  const dateRange = pullOptionsToDateRange(options)
  const tableName = `${tablePrefix}weekly_top_clients`
  const useSquare = tablePrefix === ''
  
  validateDateRange(dateRange.startISO, dateRange.endISO)
  
  try {
    const { data: acuityAppointments, error: acuityError } =  useAcuity ? await supabase
      .from(`${tablePrefix}acuity_appointments`)
      .select('appointment_date, revenue, client_id')
      .eq('user_id', userId)
      .gte('appointment_date', dateRange.startISO)
      .lte('appointment_date', dateRange.endISO)
      : { data: [], error: null }

    if (acuityError) throw acuityError

    const { data: squareAppointments, error: squareError } = useSquare
      ? await supabase
        .from('square_appointments')
        .select('appointment_date, revenue, customer_id')
        .eq('user_id', userId)
        .gte('appointment_date', dateRange.startISO)
        .lte('appointment_date', dateRange.endISO)
      : { data: [], error: null }

    if (squareError) throw squareError

    const appointments = [
      ...(acuityAppointments || []).map((appt) => ({
        source: 'acuity',
        appointment_date: appt.appointment_date,
        revenue: appt.revenue || 0,
        client_id: appt.client_id,
      })),
      ...(squareAppointments || []).map((appt) => ({
        source: 'square',
        appointment_date: appt.appointment_date,
        revenue: appt.revenue || 0,
        client_id: appt.customer_id,
      })),
    ]

    if (appointments.length === 0) {
      return { table: tableName, rowsUpserted: 0 }
    }

    const acuityClientIds = [...new Set((acuityAppointments || []).map((a) => a.client_id))]
    const squareClientIds = [...new Set((squareAppointments || []).map((a) => a.customer_id))]

    const { data: acuityClients, error: acuityClientError } = acuityClientIds.length > 0
      ? await supabase
        .from(`${tablePrefix}acuity_clients`)
        .select('client_id, first_name, last_name, email, phone_normalized')
        .eq('user_id', userId)
        .in('client_id', acuityClientIds)
      : { data: [], error: null }

    if (acuityClientError) throw acuityClientError

    const { data: squareClients, error: squareClientError } =
      useSquare && squareClientIds.length > 0
        ? await supabase
          .from('square_clients')
          .select('customer_id, first_name, last_name, email, phone_normalized')
          .eq('user_id', userId)
          .in('customer_id', squareClientIds)
        : { data: [], error: null }

    if (squareClientError) throw squareClientError

    const clientMap = new Map<string, {
      first_name: string | null
      last_name: string | null
      email: string | null
      phone_normalized: string | null
    }>()

    for (const client of acuityClients || []) {
      clientMap.set(`acuity:${client.client_id}`, client)
    }

    for (const client of squareClients || []) {
      clientMap.set(`square:${client.customer_id}`, client)
    }

    const weeklyClientStats = new Map<string, {
      clientId: string
      clientKey: string
      clientName: string
      email: string
      phone: string
      weekStart: Date
      weekEnd: Date
      weekNumber: number
      month: string
      year: number
      totalPaid: number
      numVisits: number
    }>()

    const MONTHS = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]

    for (const appt of appointments) {
      const apptDate = new Date(appt.appointment_date + 'T00:00:00')
      const weekStart = getMondayOfWeek(apptDate)
      const weekEnd = getSundayOfWeek(weekStart)
      const weekNumber = Math.ceil(weekStart.getUTCDate() / 7)
      const month = MONTHS[weekStart.getUTCMonth()]
      const year = weekStart.getUTCFullYear()

      const clientKey = `${appt.source}:${appt.client_id}`
      const key = `${formatISODate(weekStart)}||${clientKey}`

      const client = clientMap.get(clientKey)

      if (!weeklyClientStats.has(key)) {
        weeklyClientStats.set(key, {
          clientId: appt.client_id,
          clientKey,
          clientName: `${client?.first_name || ''} ${client?.last_name || ''}`.trim() || 'Unknown',
          email: client?.email || '',
          phone: client?.phone_normalized || '',
          weekStart,
          weekEnd,
          weekNumber,
          month,
          year,
          totalPaid: 0,
          numVisits: 0
        })
      }

      const stats = weeklyClientStats.get(key)!
      stats.totalPaid += appt.revenue || 0
      stats.numVisits++
    }

    const upsertData = Array.from(weeklyClientStats.values()).map(stats => ({
      user_id: userId,
      client_id: stats.clientId,
      client_key: stats.clientKey,
      client_name: stats.clientName,
      email: stats.email,
      phone: stats.phone,
      week_number: stats.weekNumber,
      start_date: formatISODate(stats.weekStart),
      end_date: formatISODate(stats.weekEnd),
      month: stats.month,
      year: stats.year,
      total_paid: Math.round(stats.totalPaid * 100) / 100,
      num_visits: stats.numVisits,
      notes: null,
      report_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }))

    if (upsertData.length > 0) {
      const { error: upsertError } = await supabase
        .from(tableName)
        .upsert(upsertData, {
          onConflict: 'user_id,week_number,month,year,client_key'
        })

      if (upsertError) throw upsertError
    }

    return { table: tableName, rowsUpserted: upsertData.length }

  } catch (err: any) {
    throw new Error(`${tableName} aggregation failed: ${err.message}`)
  }
}

/**
 * Aggregate weekly_marketing_funnels_base table
 */
async function aggregateWeeklyMarketingFunnels(
  context: PullContext,
  orchestratorOptions: OrchestratorOptions = {}
): Promise<AggregationResult> {
  const { supabase, userId, options } = context
  const { tablePrefix = '' } = orchestratorOptions
  
  const dateRange = pullOptionsToDateRange(options)
  const tableName = `${tablePrefix}weekly_marketing_funnels_base`
  
  validateDateRange(dateRange.startISO, dateRange.endISO)

  console.log(dateRange.startISO)
  console.log(dateRange.endISO)
  
  try {
    // Fetch clients whose FIRST appointment is in the date range
    const { data: clients, error: clientError } = useAcuity ? await supabase
      .from(`${tablePrefix}acuity_clients`)
      .select('client_id, first_appt, first_source, first_name, last_name')
      .eq('user_id', userId)
      .gte('first_appt', dateRange.startISO)
      .lte('first_appt', dateRange.endISO)
      : { data: [], error: null }

    if (clientError) throw clientError
    if (!clients || clients.length === 0) {
      return { table: tableName, rowsUpserted: 0 }
    }

    // Filter out invalid sources
    const validClients = clients.filter(c => {
      const source = (c.first_source || '').trim().toLowerCase()
      return source !== '' && 
             source !== 'unknown' && 
             source !== 'returning client'
    })

    if (validClients.length === 0) {
      return { table: tableName, rowsUpserted: 0 }
    }

    // Get the client IDs to fetch their first appointment revenue
    const clientIds = validClients.map(c => c.client_id)
    
    // Fetch ONLY the first appointment for each client (to get revenue)
    const { data: firstAppointments, error: apptError } = await supabase
      .from(`${tablePrefix}acuity_appointments`)
      .select('client_id, appointment_date, revenue')
      .eq('user_id', userId)
      .in('client_id', clientIds)

    if (apptError) throw apptError

    // Create a map of client_id -> first appointment data
    const firstApptMap = new Map<string, { date: string; revenue: number }>()
    
    for (const appt of firstAppointments || []) {
      const existing = firstApptMap.get(appt.client_id)
      // Keep only the earliest appointment for each client
      if (!existing || appt.appointment_date < existing.date) {
        firstApptMap.set(appt.client_id, {
          date: appt.appointment_date,
          revenue: appt.revenue || 0
        })
      }
    }

    // Group by week + source
    const funnelStats = new Map<string, {
      source: string
      weekNumber: number
      month: string
      year: number
      newClients: Set<string>
      clientNames: string[]
      totalRevenue: number
      totalVisits: number
    }>()

    const MONTHS = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]

    for (const client of validClients) {
      const firstApptDate = new Date(client.first_appt + 'T00:00:00')
      const weekStart = getMondayOfWeek(firstApptDate)
      const weekNumber = Math.ceil(weekStart.getUTCDate() / 7)
      const month = MONTHS[weekStart.getUTCMonth()]
      const year = weekStart.getUTCFullYear()
      const source = client.first_source // Already validated above
      
      const key = `${formatISODate(weekStart)}||${source}`

      if (!funnelStats.has(key)) {
        funnelStats.set(key, {
          source,
          weekNumber,
          month,
          year,
          newClients: new Set(),
          clientNames: [],
          totalRevenue: 0,
          totalVisits: 0
        })
      }

      const stats = funnelStats.get(key)!
      stats.newClients.add(client.client_id)
      
      const clientName = `${client.first_name || ''} ${client.last_name || ''}`.trim()
      if (clientName && !stats.clientNames.includes(clientName)) {
        stats.clientNames.push(clientName)
      }

      // Add revenue from their first appointment only
      const firstAppt = firstApptMap.get(client.client_id)
      if (firstAppt) {
        stats.totalRevenue += firstAppt.revenue
        stats.totalVisits++
      }
    }

    // Convert to upsert payload
    const upsertData = Array.from(funnelStats.values()).map(stats => {
      const avgTicket = stats.totalVisits > 0
        ? stats.totalRevenue / stats.totalVisits
        : 0

      return {
        user_id: userId,
        source: stats.source,
        week_number: stats.weekNumber,
        report_month: stats.month,
        report_year: stats.year,
        new_clients: stats.newClients.size,
        returning_clients: 0,
        new_clients_retained: 0,
        retention: 0,
        avg_ticket: Math.round(avgTicket * 100) / 100,
        client_names: stats.clientNames,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    })

    if (upsertData.length > 0) {
      const { error: upsertError } = await supabase
        .from(tableName)
        .upsert(upsertData, {
          onConflict: 'user_id,source,week_number,report_month,report_year'
        })

      if (upsertError) throw upsertError
    }

    return { table: tableName, rowsUpserted: upsertData.length }

  } catch (err: any) {
    throw new Error(`${tableName} aggregation failed: ${err.message}`)
  }
}