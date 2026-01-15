// lib/booking/processors/aggregations/monthly.ts

import { PullContext, AggregationResult } from '../../types'
import { OrchestratorOptions, pullOptionsToDateRange } from '../../orchestrator'
import { validateDateRange } from './shared/utils'

export async function runMonthlyAggregation(
  context: PullContext,
  orchestratorOptions: OrchestratorOptions = {}
): Promise<AggregationResult[]> {
  const [monthlyData, topClients, serviceBookings, marketingFunnels] = await Promise.all([
    aggregateMonthlyData(context, orchestratorOptions),
    aggregateReportTopClients(context, orchestratorOptions),
    aggregateServiceBookings(context, orchestratorOptions),
    aggregateMonthlyMarketingFunnels(context, orchestratorOptions)
  ])
  
  return [monthlyData, topClients, serviceBookings, marketingFunnels]
}

/**
 * Aggregate monthly_data table
 */
async function aggregateMonthlyData(
  context: PullContext,
  orchestratorOptions: OrchestratorOptions = {}
): Promise<AggregationResult> {
  const { supabase, userId, options } = context
  const { tablePrefix = '' } = orchestratorOptions
  
  const dateRange = pullOptionsToDateRange(options)
  const tableName = `${tablePrefix}monthly_data`
  const includeSquare = tablePrefix === ''
  
  validateDateRange(dateRange.startISO, dateRange.endISO)
  
  try {
    const { data: acuityAppointments, error: acuityError } = await supabase
      .from(`${tablePrefix}acuity_appointments`)
      .select('appointment_date, revenue, tip, client_id')
      .eq('user_id', userId)
      .gte('appointment_date', dateRange.startISO)
      .lte('appointment_date', dateRange.endISO)

    if (acuityError) throw acuityError

    const { data: squareAppointments, error: squareError } = includeSquare
      ? await supabase
        .from('square_appointments')
        .select('appointment_date, revenue, tip, customer_id, order_id')
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

    const { data: squarePayments, error: paymentError } = includeSquare
      ? await supabase
        .from('square_payments')
        .select('appointment_date, amount_total, tip_amount, order_id, status')
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
      includeSquare && squareClientIds.length > 0
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

    const monthlyStats = new Map<string, {
      month: string
      year: number
      num_appointments: number
      total_revenue: number
      tips: number
      uniqueClients: Set<string>
      newClients: Set<string>
      returningClients: Set<string>
    }>()

    const MONTHS = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]

    for (const appt of appointments) {
      const apptDate = new Date(appt.appointment_date + 'T00:00:00')
      const month = MONTHS[apptDate.getUTCMonth()]
      const year = apptDate.getUTCFullYear()
      const key = `${year}||${month}`

      if (!monthlyStats.has(key)) {
        monthlyStats.set(key, {
          month,
          year,
          num_appointments: 0,
          total_revenue: 0,
          tips: 0,
          uniqueClients: new Set(),
          newClients: new Set(),
          returningClients: new Set()
        })
      }

      const stats = monthlyStats.get(key)!
      stats.num_appointments++
      stats.total_revenue += appt.revenue || 0
      stats.tips += appt.tip || 0

      const clientKey = `${appt.source}:${appt.client_id}`
      stats.uniqueClients.add(clientKey)

      const client = clientMap.get(clientKey)
      if (client?.first_appt) {
        const firstApptDate = new Date(client.first_appt + 'T00:00:00')
        const firstApptMonth = MONTHS[firstApptDate.getUTCMonth()]
        const firstApptYear = firstApptDate.getUTCFullYear()
        
        if (firstApptMonth === month && firstApptYear === year) {
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

      const apptDate = new Date(date + 'T00:00:00')
      const month = MONTHS[apptDate.getUTCMonth()]
      const year = apptDate.getUTCFullYear()
      const key = `${year}||${month}`

      if (!monthlyStats.has(key)) {
        monthlyStats.set(key, {
          month,
          year,
          num_appointments: 0,
          total_revenue: 0,
          tips: 0,
          uniqueClients: new Set(),
          newClients: new Set(),
          returningClients: new Set()
        })
      }

      const stats = monthlyStats.get(key)!
      stats.total_revenue += Number(payment.amount_total) || 0
      stats.tips += Number(payment.tip_amount) || 0
    }

    const upsertData = Array.from(monthlyStats.values()).map(stats => {
      const avgTicket = stats.num_appointments > 0 
        ? stats.total_revenue / stats.num_appointments 
        : 0

      return {
        user_id: userId,
        month: stats.month,
        year: stats.year,
        num_appointments: stats.num_appointments,
        total_revenue: stats.total_revenue,
        tips: stats.tips,
        final_revenue: stats.total_revenue + stats.tips,
        expenses: 0,
        avg_ticket: Math.round(avgTicket * 100) / 100,
        unique_clients: stats.uniqueClients.size,
        new_clients: stats.newClients.size,
        returning_clients: stats.returningClients.size,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    })

    if (upsertData.length > 0) {
      const { error: upsertError } = await supabase
        .from(tableName)
        .upsert(upsertData, {
          onConflict: 'user_id,month,year'
        })

      if (upsertError) throw upsertError
    }

    return { table: tableName, rowsUpserted: upsertData.length }

  } catch (err: any) {
    throw new Error(`${tableName} aggregation failed: ${err.message}`)
  }
}

/**
 * Aggregate report_top_clients table
 */
async function aggregateReportTopClients(
  context: PullContext,
  orchestratorOptions: OrchestratorOptions = {}
): Promise<AggregationResult> {
  const { supabase, userId, options } = context
  const { tablePrefix = '' } = orchestratorOptions
  
  const dateRange = pullOptionsToDateRange(options)
  const tableName = `${tablePrefix}report_top_clients`
  const includeSquare = tablePrefix === ''
  
  validateDateRange(dateRange.startISO, dateRange.endISO)
  
  try {
    const { data: acuityAppointments, error: acuityError } = await supabase
      .from(`${tablePrefix}acuity_appointments`)
      .select('appointment_date, revenue, client_id')
      .eq('user_id', userId)
      .gte('appointment_date', dateRange.startISO)
      .lte('appointment_date', dateRange.endISO)

    if (acuityError) throw acuityError

    const { data: squareAppointments, error: squareError } = includeSquare
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
      includeSquare && squareClientIds.length > 0
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

    const clientStats = new Map<string, {
      clientId: string
      clientKey: string
      clientName: string
      email: string
      phone: string
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
      const month = MONTHS[apptDate.getUTCMonth()]
      const year = apptDate.getUTCFullYear()

      const clientKey = `${appt.source}:${appt.client_id}`
      const key = `${year}||${month}||${clientKey}`

      const client = clientMap.get(clientKey)

      if (!clientStats.has(key)) {
        clientStats.set(key, {
          clientId: appt.client_id,
          clientKey,
          clientName: `${client?.first_name || ''} ${client?.last_name || ''}`.trim() || 'Unknown',
          email: client?.email || '',
          phone: client?.phone_normalized || '',
          month,
          year,
          totalPaid: 0,
          numVisits: 0
        })
      }

      const stats = clientStats.get(key)!
      stats.totalPaid += appt.revenue || 0
      stats.numVisits++
    }

    const upsertData = Array.from(clientStats.values()).map(stats => ({
      user_id: userId,
      client_id: stats.clientId,
      client_key: stats.clientKey,
      client_name: stats.clientName,
      email: stats.email,
      phone: stats.phone,
      month: stats.month,
      year: stats.year,
      total_paid: Math.round(stats.totalPaid * 100) / 100,
      num_visits: stats.numVisits,
      rank: null,
      report_id: null,
      notes: null,
      updated_at: new Date().toISOString()
    }))

    if (upsertData.length > 0) {
      const { error: upsertError } = await supabase
        .from(tableName)
        .upsert(upsertData, {
          onConflict: 'user_id,month,year,client_key'
        })

      if (upsertError) throw upsertError
    }

    return { table: tableName, rowsUpserted: upsertData.length }

  } catch (err: any) {
    throw new Error(`${tableName} aggregation failed: ${err.message}`)
  }
}

/**
 * Aggregate service_bookings table
 */
async function aggregateServiceBookings(
  context: PullContext,
  orchestratorOptions: OrchestratorOptions = {}
): Promise<AggregationResult> {
  const { supabase, userId, options } = context
  const { tablePrefix = '' } = orchestratorOptions
  
  const dateRange = pullOptionsToDateRange(options)
  const tableName = `${tablePrefix}service_bookings`
  const includeSquare = tablePrefix === ''
  
  validateDateRange(dateRange.startISO, dateRange.endISO)
  
  try {
    const { data: acuityAppointments, error: acuityError } = await supabase
      .from(`${tablePrefix}acuity_appointments`)
      .select('appointment_date, service_type, revenue')
      .eq('user_id', userId)
      .gte('appointment_date', dateRange.startISO)
      .lte('appointment_date', dateRange.endISO)

    if (acuityError) throw acuityError

    const { data: squareAppointments, error: squareError } = includeSquare
      ? await supabase
        .from('square_appointments')
        .select('appointment_date, service_type, revenue')
        .eq('user_id', userId)
        .gte('appointment_date', dateRange.startISO)
        .lte('appointment_date', dateRange.endISO)
      : { data: [], error: null }

    if (squareError) throw squareError

    const appointments = [
      ...(acuityAppointments || []),
      ...(squareAppointments || []),
    ]

    if (appointments.length === 0) {
      return { table: tableName, rowsUpserted: 0 }
    }

    const serviceStats = new Map<string, {
      serviceName: string
      month: string
      year: number
      bookings: number
      price: number
    }>()

    const MONTHS = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]

    for (const appt of appointments) {
      const apptDate = new Date(appt.appointment_date + 'T00:00:00')
      const month = MONTHS[apptDate.getUTCMonth()]
      const year = apptDate.getUTCFullYear()
      
      const serviceName = (appt.service_type || 'Unknown')
        .trim()
        .replace(/\s+/g, ' ')
        .split(' ')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
      
      const key = `${year}||${month}||${serviceName}`

      if (!serviceStats.has(key)) {
        serviceStats.set(key, {
          serviceName,
          month,
          year,
          bookings: 0,
          price: appt.revenue || 0
        })
      }

      const stats = serviceStats.get(key)!
      stats.bookings++
      if (!stats.price && appt.revenue) {
        stats.price = appt.revenue
      }
    }

    const upsertData = Array.from(serviceStats.values()).map(stats => ({
      user_id: userId,
      service_name: stats.serviceName,
      report_month: stats.month,
      report_year: stats.year,
      bookings: stats.bookings,
      price: stats.price,
      created_at: new Date().toISOString()
    }))

    if (upsertData.length > 0) {
      const { error: upsertError } = await supabase
        .from(tableName)
        .upsert(upsertData, {
          onConflict: 'user_id,service_name,report_month,report_year'
        })

      if (upsertError) throw upsertError
    }

    return { table: tableName, rowsUpserted: upsertData.length }

  } catch (err: any) {
    throw new Error(`${tableName} aggregation failed: ${err.message}`)
  }
}

/**
 * Aggregate marketing_funnels table (monthly)
 */
async function aggregateMonthlyMarketingFunnels(
  context: PullContext,
  orchestratorOptions: OrchestratorOptions = {}
): Promise<AggregationResult> {
  const { supabase, userId, options } = context
  const { tablePrefix = '' } = orchestratorOptions
  
  const dateRange = pullOptionsToDateRange(options)
  const tableName = `${tablePrefix}marketing_funnels`  // ✅ Fixed table name
  
  validateDateRange(dateRange.startISO, dateRange.endISO)
  
  try {
    // Fetch clients whose FIRST appointment is in the date range
    const { data: clients, error: clientError } = await supabase
      .from(`${tablePrefix}acuity_clients`)
      .select('client_id, first_appt, first_source, first_name, last_name')
      .eq('user_id', userId)
      .gte('first_appt', dateRange.startISO)
      .lte('first_appt', dateRange.endISO)

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

    // Group by month + source
    const funnelStats = new Map<string, {
      source: string
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
      const month = MONTHS[firstApptDate.getMonth()]
      const year = firstApptDate.getFullYear()
      const source = client.first_source
      
      const key = `${year}||${month}||${source}`

      if (!funnelStats.has(key)) {
        funnelStats.set(key, {
          source,
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
          onConflict: 'user_id,source,report_month,report_year'
        })

      if (upsertError) throw upsertError
    }

    return { table: tableName, rowsUpserted: upsertData.length }

  } catch (err: any) {
    throw new Error(`${tableName} aggregation failed: ${err.message}`)
  }
}