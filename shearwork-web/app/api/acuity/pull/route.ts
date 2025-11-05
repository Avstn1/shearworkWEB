'use server'

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get('endpoint') || 'appointments'
  const requestedMonth = searchParams.get('month') || null // e.g. "October"
  const requestedYear = searchParams.get('year') ? parseInt(searchParams.get('year') as string, 10) : null // e.g. 2025

  // 2️⃣ Fetch token from DB
  const { data: tokenRow, error: tokenError } = await supabase
    .from('acuity_tokens')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (tokenError || !tokenRow) {
    return NextResponse.json({ error: 'No Acuity connection found' }, { status: 400 })
  }

  // 3️⃣ Refresh token if expired
  let accessToken = tokenRow.access_token
  const now = Math.floor(Date.now() / 1000)

  if (tokenRow.expires_at && tokenRow.expires_at < now) {
    try {
      const refreshRes = await fetch('https://acuityscheduling.com/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: tokenRow.refresh_token,
          client_id: process.env.ACUITY_CLIENT_ID!,
          client_secret: process.env.ACUITY_CLIENT_SECRET!,
        }),
      })

      const newTokens = await refreshRes.json()

      if (refreshRes.ok) {
        accessToken = newTokens.access_token
        await supabase
          .from('acuity_tokens')
          .update({
            access_token: newTokens.access_token,
            refresh_token: newTokens.refresh_token ?? tokenRow.refresh_token,
            expires_at: now + newTokens.expires_in,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
      } else {
        console.error('Token refresh failed:', newTokens)
        return NextResponse.json({ error: 'Token refresh failed', details: newTokens }, { status: 500 })
      }
    } catch (err) {
      return NextResponse.json({ error: 'Failed to refresh token', details: String(err) })
    }
  }

  // 4️⃣ Validate endpoint
  const ALLOWED_ENDPOINTS = [
    'appointments',
    'clients',
    'calendars',
    'appointment-types',
    'availability',
    'blocks',
    'categories',
    'forms',
    'packages',
    'products',
  ]

  if (!ALLOWED_ENDPOINTS.includes(endpoint)) {
    return NextResponse.json({ error: `Invalid endpoint '${endpoint}'` }, { status: 400 })
  }

  // 5️⃣ Fetch data from Acuity
  const acuityRes = await fetch(`https://acuityscheduling.com/api/v1/${endpoint}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  const acuityData = await acuityRes.json()
  if (!acuityRes.ok) {
    console.error('❌ Failed to fetch from Acuity:', acuityData)
    return NextResponse.json({ error: 'Failed to fetch from Acuity', details: acuityData }, { status: 500 })
  }

  console.log('💧 Acuity data fetched for endpoint:', endpoint)
  console.log('📦 Total items fetched:', Array.isArray(acuityData) ? acuityData.length : 'n/a')
  console.log('🔎 Requested month/year:', requestedMonth, requestedYear)

  // 6️⃣ Process appointments
  if (endpoint === 'appointments' && Array.isArray(acuityData)) {
    let appointmentsToProcess = acuityData

    if (requestedMonth || requestedYear) {
      appointmentsToProcess = acuityData.filter((appt: any) => {
        try {
          // Use the date the appointment was created, not the appointment datetime
          const date = new Date(appt.datetimeCreated)
          const monthNum = date.getUTCMonth() + 1
          const yearNum = date.getUTCFullYear()

          let requestedMonthNum: number | null = null
          if (requestedMonth) {
            requestedMonthNum = MONTHS.findIndex(
              (m) => m.toLowerCase() === requestedMonth.toLowerCase()
            ) + 1
          }

          if (requestedMonthNum && requestedYear) return monthNum === requestedMonthNum && yearNum === requestedYear
          if (requestedMonthNum) return monthNum === requestedMonthNum
          if (requestedYear) return yearNum === requestedYear
          return true
        } catch {
          return false
        }
      })
    }

    console.log('🧾 Appointments to process count:', appointmentsToProcess.length)

    const groupedByMonth: Record<string, any[]> = {}

    for (const appt of appointmentsToProcess) {
      const date = new Date(appt.datetime)
      const monthName = MONTHS[date.getUTCMonth()]
      const year = date.getUTCFullYear()
      const key = `${year}||${monthName}`
      if (!groupedByMonth[key]) groupedByMonth[key] = []
      groupedByMonth[key].push(appt)
    }

    const revenueByMonth: Record<string, number> = {}
    const avgTicketByMonth: Record<string, number> = {}

    for (const [key, appts] of Object.entries(groupedByMonth)) {
      const totalRevenue = appts.reduce((sum, a) => sum + parseFloat(a.priceSold || '0'), 0)
      const avgTicket = appts.length > 0 ? totalRevenue / appts.length : 0

      revenueByMonth[key] = totalRevenue
      avgTicketByMonth[key] = parseFloat(avgTicket.toFixed(2))
    }

    console.log('📊 Calculated revenueByMonth:', revenueByMonth)
    console.log('🎟️ Calculated avgTicketByMonth:', avgTicketByMonth)

    const upsertRows = Object.keys(revenueByMonth).map((key) => {
      const [year, month] = key.split('||')
      return {
        user_id: user.id,
        month,
        year: parseInt(year),
        total_revenue: revenueByMonth[key],
        avg_ticket: avgTicketByMonth[key],
        updated_at: new Date().toISOString(),
      }
    })

    const { error: upsertError } = await supabase.from('monthly_data').upsert(upsertRows, {
      onConflict: 'user_id,month,year',
    })

    if (upsertError) console.error('❌ Failed to update monthly_data:', upsertError)
    else console.log('✅ monthly_data table updated successfully!')

    // --- Bookings per service
    const serviceCounts: Record<string, { month: string; year: number; count: number }> = {}
    for (const appt of appointmentsToProcess) {
      const service = appt.type || 'Unknown'
      const date = new Date(appt.datetime)
      const month = MONTHS[date.getUTCMonth()]
      const year = date.getUTCFullYear()
      const key = `${service}||${month}||${year}`
      if (!serviceCounts[key]) serviceCounts[key] = { month, year, count: 0 }
      serviceCounts[key].count++
    }

    const serviceUpserts = Object.entries(serviceCounts).map(([key, val]) => {
      const [service, month, year] = key.split('||')
      return {
        user_id: user.id,
        service_name: service,
        bookings: val.count,
        report_month: month,
        report_year: parseInt(year),
        created_at: new Date().toISOString(),
      }
    })

    const { error: bookingsError } = await supabase
      .from('service_bookings')
      .upsert(serviceUpserts, { onConflict: 'user_id,service_name,report_month,report_year' })

    if (bookingsError) console.error('❌ Failed to update service_bookings:', bookingsError)
    else console.log('✅ service_bookings table updated successfully!')

    // --- Top clients
    const monthlyClientMap: Record<
      string,
      Record<string, { client_name: string; email: string; total_paid: number; num_visits: number; month: string; year: number }>
    > = {}

    for (const appt of appointmentsToProcess) {
      const email = appt.email?.toLowerCase() || ''
      if (!email) continue

      const date = new Date(appt.datetime)
      const month = MONTHS[date.getUTCMonth()]
      const year = date.getUTCFullYear()
      const key = `${year}||${month}`

      if (!monthlyClientMap[key]) monthlyClientMap[key] = {}
      if (!monthlyClientMap[key][email]) {
        monthlyClientMap[key][email] = {
          client_name: appt.firstName && appt.lastName ? `${appt.firstName} ${appt.lastName}` : 'Unknown',
          email,
          total_paid: 0,
          num_visits: 0,
          month,
          year,
        }
      }

      monthlyClientMap[key][email].total_paid += parseFloat(appt.priceSold || '0')
      monthlyClientMap[key][email].num_visits += 1
    }

    for (const [key, clients] of Object.entries(monthlyClientMap)) {
      const upsertClients = Object.values(clients).map((c) => ({
        user_id: user.id,
        client_name: c.client_name,
        email: c.email,
        total_paid: c.total_paid,
        num_visits: c.num_visits,
        month: c.month,
        year: c.year,
        updated_at: new Date().toISOString(),
      }))

      const { error: clientsError } = await supabase
        .from('report_top_clients')
        .upsert(upsertClients, { onConflict: 'user_id,month,year,email' })

      if (clientsError) console.error(`❌ Failed to upsert clients for ${key}:`, clientsError)
      else console.log(`✅ Upserted ${upsertClients.length} clients for ${key} successfully!`)
    }
  }

  return NextResponse.json({
    endpoint,
    fetched_at: new Date().toISOString(),
    acuity_data: acuityData,
  })
}
