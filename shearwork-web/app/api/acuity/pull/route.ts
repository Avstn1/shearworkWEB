'use server'

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import crypto from 'crypto'

/** ------------------------ Constants ------------------------ */
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

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

const REFERRAL_KEYWORDS = [
  'referral', 'referred', 'hear', 'heard', 'source', 'social', 'instagram', 'facebook', 'tiktok'
]

/** ------------------------ Date Helpers ------------------------ */

// Returns YYYY-MM-DD string in UTC for a Date object
function toUTCDateString(d: Date) {
  return d.toISOString().split('T')[0]
}

// Parse date safely without timezone shift
function parseDateStringSafe(datetime: string | null | undefined) {
  if (!datetime) return null
  try {
    const datePart = datetime.split('T')[0]
    const [y, m, d] = datePart.split('-').map(Number)
    if ([y, m, d].some(Number.isNaN)) throw new Error('Invalid date parts')
    return {
      year: y,
      monthIndex: m,
      monthName: MONTHS[m - 1] || 'Unknown',
      dayKey: `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      day: d,
    }
  } catch {
    try {
      const dt = new Date(datetime)
      const y = dt.getUTCFullYear()
      const m = dt.getUTCMonth() + 1
      const d = dt.getUTCDate()
      return {
        year: y,
        monthIndex: m,
        monthName: MONTHS[m - 1] || 'Unknown',
        dayKey: toUTCDateString(dt),
        day: d,
      }
    } catch {
      return null
    }
  }
}

// Get all dates in a month up to today (YYYY-MM-DD, en-CA)
function getAllDatesInMonth(monthName: string, year: number): string[] {
  const start = new Date(`${monthName} 1, ${year} UTC`)
  const end = new Date(start)
  end.setMonth(end.getMonth() + 1)
  end.setDate(0) // last day of month

  const today = new Date()
  if (end > today) {
    end.setUTCFullYear(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  }

  const dates: string[] = []
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(toUTCDateString(d))
  }
  return dates
}

/** ------------------------ Main API ------------------------ */
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get('endpoint') || 'appointments'
  const requestedMonth = searchParams.get('month') || null
  const requestedYear = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : null

  if (!ALLOWED_ENDPOINTS.includes(endpoint)) {
    return NextResponse.json({ error: `Invalid endpoint '${endpoint}'` }, { status: 400 })
  }

  /** ------------------------ Fetch and Refresh Token ------------------------ */
  const { data: tokenRow, error: tokenError } = await supabase
    .from('acuity_tokens')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (tokenError || !tokenRow) return NextResponse.json({ error: 'No Acuity connection found' }, { status: 400 })

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
      if (!refreshRes.ok) throw new Error(JSON.stringify(newTokens))

      accessToken = newTokens.access_token
      await supabase.from('acuity_tokens')
        .update({
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token ?? tokenRow.refresh_token,
          expires_at: now + newTokens.expires_in,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
    } catch (err) {
      return NextResponse.json({ error: 'Token refresh failed', details: String(err) })
    }
  }

  /** ------------------------ Fetch Data ------------------------ */
  let allData: any[] = []

  try {
    if (endpoint === 'appointments' && requestedMonth && requestedYear) {
      const dates = getAllDatesInMonth(requestedMonth, requestedYear)
      for (const day of dates) {
        const dayUrl = new URL('https://acuityscheduling.com/api/v1/appointments')
        dayUrl.searchParams.set('minDate', day)
        dayUrl.searchParams.set('maxDate', day)
        dayUrl.searchParams.set('max', '100')

        const res = await fetch(dayUrl.toString(), { headers: { Authorization: `Bearer ${accessToken}` } })
        const dayData = await res.json()
        if (res.ok && Array.isArray(dayData)) allData.push(...dayData)
        else console.error('Failed fetching appointments for', day, dayData)
      }
    } else {
      const baseUrl = new URL(`https://acuityscheduling.com/api/v1/${endpoint}`)
      baseUrl.searchParams.set('max', '100')
      const res = await fetch(baseUrl.toString(), { headers: { Authorization: `Bearer ${accessToken}` } })
      const pageData = await res.json()
      if (res.ok && Array.isArray(pageData)) allData.push(...pageData)
      else return NextResponse.json({ error: 'Failed to fetch from Acuity', details: pageData }, { status: 500 })
    }
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch data', details: String(err) }, { status: 500 })
  }

  console.log('💧 Total fetched:', allData.length)

  /** ------------------------ Process Appointments ------------------------ */
  if (endpoint === 'appointments' && Array.isArray(allData)) {
    const groupedByMonth: Record<string, any[]> = {}
    const groupedByDay: Record<string, any[]> = {}
    const nowDate = new Date() // Current datetime

    // Filter out future appointments
    const pastAppointments = allData.filter(appt => {
      const apptDate = new Date(appt.datetime)
      return apptDate <= nowDate
    })

    for (const appt of pastAppointments) {
      const parsed = parseDateStringSafe(appt.datetime)
      let dayKey: string, monthName: string, year: number
      if (parsed) {
        ({ dayKey, monthName, year } = parsed)
      } else {
        const fallback = new Date(appt.datetime)
        dayKey = toUTCDateString(fallback)
        monthName = MONTHS[fallback.getUTCMonth()]
        year = fallback.getUTCFullYear()
      }

      const monthKey = `${year}||${monthName}`
      groupedByMonth[monthKey] ||= []
      groupedByMonth[monthKey].push(appt)

      groupedByDay[dayKey] ||= []
      groupedByDay[dayKey].push(appt)
    }

    /** ---- Upsert Monthly Data ---- */
    const monthlyUpserts = Object.entries(groupedByMonth).map(([key, appts]) => {
      const [yearStr, month] = key.split('||')
      return {
        user_id: user.id,
        month,
        year: parseInt(yearStr),
        total_revenue: appts.reduce((sum, a) => sum + parseFloat(a.priceSold || '0'), 0),
        num_appointments: appts.length,
        updated_at: new Date().toISOString(),
      }
    })
    await supabase.from('monthly_data').upsert(monthlyUpserts, { onConflict: 'user_id,month,year' })

    /** ---- Upsert Daily Data ---- */
    for (const [day, appts] of Object.entries(groupedByDay)) {
      const totalRevenue = appts.reduce((sum, a) => sum + parseFloat(a.priceSold || '0'), 0)
      const numAppointments = appts.length
      const [y, m] = day.split('-').map(Number)
      const month = MONTHS[m - 1]
      const year = y

      const { data: existingRows, error: selectErr } = await supabase
        .from('daily_data')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', day)
        .maybeSingle()

      if (selectErr) console.error('❌ Error selecting existing daily row:', selectErr)

      if (existingRows?.id) {
        await supabase.from('daily_data').update({
          total_revenue: totalRevenue,
          num_appointments: numAppointments,
          month,
          year,
          updated_at: new Date().toISOString(),
        }).eq('id', existingRows.id)
      } else {
        await supabase.from('daily_data').insert([{
          user_id: user.id,
          date: day,
          total_revenue: totalRevenue,
          num_appointments: numAppointments,
          month,
          year,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
      }
    }

    /** ---- Service Bookings, Clients, Funnels ---- */
    // Use `pastAppointments` instead of allData everywhere to ignore future
    const serviceCounts: Record<string, { month: string; year: number; count: number }> = {}
    for (const appt of pastAppointments) {
      const parsed = parseDateStringSafe(appt.datetime)
      let monthName = parsed?.monthName ?? 'Unknown'
      let year = parsed?.year ?? new Date().getUTCFullYear()
      const service = appt.type || 'Unknown'
      const key = `${service}||${monthName}||${year}`
      serviceCounts[key] = serviceCounts[key] || { month: monthName, year, count: 0 }
      serviceCounts[key].count++
    }

    const monthYearMap: Record<string, Record<string, number>> = {}
    for (const [key, val] of Object.entries(serviceCounts)) {
      const [service, month, year] = key.split('||')
      const combo = `${month}||${year}`
      monthYearMap[combo] ||= {}
      monthYearMap[combo][service] = val.count
    }

    const finalUpserts: any[] = []
    for (const [combo, services] of Object.entries(monthYearMap)) {
      const [month, yearStr] = combo.split('||')
      const year = parseInt(yearStr)
      const sorted = Object.entries(services).sort((a, b) => b[1] - a[1])
      const top5 = sorted.slice(0, 5)
      const others = sorted.slice(5)

      let otherCount = others.reduce((sum, [, c]) => sum + c, 0)

      for (const [service, count] of top5) {
        finalUpserts.push({ user_id: user.id, service_name: service, bookings: count, report_month: month, report_year: year, created_at: new Date().toISOString() })
      }
      if (otherCount > 0) finalUpserts.push({ user_id: user.id, service_name: 'Other', bookings: otherCount, report_month: month, report_year: year, created_at: new Date().toISOString() })
    }

    await supabase.from('service_bookings').upsert(finalUpserts, { onConflict: 'user_id,service_name,report_month,report_year' })

    /** ---- Top Clients ---- */
    const monthlyClientMap: Record<string, Record<string, any>> = {}

    for (const appt of pastAppointments) {
      const parsed = parseDateStringSafe(appt.datetime)
      const monthName = parsed?.monthName ?? 'Unknown'
      const year = parsed?.year ?? new Date().getUTCFullYear()
      const key = `${year}||${monthName}`

      const name = appt.firstName && appt.lastName ? `${appt.firstName} ${appt.lastName}` : 'Unknown'
      const email = appt.email?.toLowerCase().trim() || null
      const phone = appt.phone?.replace(/\D/g, '') || null
      const clientKey = crypto.createHash('md5').update(`${email || ''}|${phone || ''}|${name.toLowerCase()}`).digest('hex')

      monthlyClientMap[key] ||= {}
      monthlyClientMap[key][clientKey] ||= { client_name: name, email, phone, client_key: clientKey, total_paid: 0, num_visits: 0, month: monthName, year }
      monthlyClientMap[key][clientKey].total_paid += parseFloat(appt.priceSold || '0')
      monthlyClientMap[key][clientKey].num_visits++
    }

    for (const [key, clients] of Object.entries(monthlyClientMap)) {
      const upsertClients = Object.values(clients).map(c => ({
        user_id: user.id,
        client_name: c.client_name,
        email: c.email,
        phone: c.phone,
        client_key: c.client_key,
        total_paid: c.total_paid,
        num_visits: c.num_visits,
        month: c.month,
        year: c.year,
        updated_at: new Date().toISOString(),
      }))
      await supabase.from('report_top_clients').upsert(upsertClients, { onConflict: 'user_id,month,year,client_key' })
    }

    /** ---- Marketing Funnels ---- */
    const funnelMap: Record<string, Record<string, any>> = {}

    for (const appt of pastAppointments) {
      const parsed = parseDateStringSafe(appt.datetime)
      const monthName = parsed?.monthName ?? 'Unknown'
      const year = parsed?.year ?? new Date().getUTCFullYear()
      const key = `${monthName}||${year}`
      if (!appt.forms || !Array.isArray(appt.forms)) continue

      for (const form of appt.forms) {
        if (!form.values || !Array.isArray(form.values)) continue

        for (const field of form.values) {
          const fieldName = field.name?.toLowerCase() || ''
          if (!REFERRAL_KEYWORDS.some(k => fieldName.includes(k))) continue

          const source = (field.value || 'Unknown').trim() || 'Unknown'
          funnelMap[key] ||= {}
          funnelMap[key][source] ||= { newClients: 0, returningClients: 0, totalRevenue: 0, totalVisits: 0 }

          const isReturning = pastAppointments.some(other => other.email === appt.email &&
            (parseDateStringSafe(other.datetime)?.dayKey || '') < (parseDateStringSafe(appt.datetime)?.dayKey || '')
          )

          if (isReturning) funnelMap[key][source].returningClients++
          else funnelMap[key][source].newClients++

          funnelMap[key][source].totalRevenue += parseFloat(appt.priceSold || '0')
          funnelMap[key][source].totalVisits++
        }
      }
    }

    const funnelUpserts = Object.entries(funnelMap).flatMap(([key, sources]) => {
      const [month, yearStr] = key.split('||')
      const report_year = parseInt(yearStr)
      return Object.entries(sources).map(([source, stats]) => ({
        user_id: user.id,
        source,
        new_clients: stats.newClients,
        returning_clients: stats.returningClients,
        retention: stats.newClients + stats.returningClients > 0
          ? (stats.returningClients / (stats.newClients + stats.returningClients)) * 100
          : 0,
        avg_ticket: stats.totalVisits > 0 ? stats.totalRevenue / stats.totalVisits : 0,
        report_month: month,
        report_year,
        created_at: new Date().toISOString(),
      }))
    })

    if (funnelUpserts.length > 0) {
      await supabase.from('marketing_funnels').upsert(funnelUpserts, { onConflict: 'user_id,source,report_month,report_year' })
    }
  }

  return NextResponse.json({ endpoint, fetched_at: new Date().toISOString(), acuity_data: allData })
}
