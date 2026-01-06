'use server'

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import {
  normalizePhone,
  buildClientKey,
  extractSourceFromForms,
  TimeframeDef,
  FunnelStats,
} from '@/lib/marketingFunnels'

const MONTH_INDEX: Record<string, number> = {
  January: 0,
  February: 1,
  March: 2,
  April: 3,
  May: 4,
  June: 5,
  July: 6,
  August: 7,
  September: 8,
  October: 9,
  November: 10,
  December: 11,
};

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const requestedYear = searchParams.get('year')
    ? parseInt(searchParams.get('year') as string, 10)
    : null

  const requestedMonth = searchParams.get('month')
    ? searchParams.get('month') as string
    : null

  if (!requestedYear) {
    return NextResponse.json(
      { error: 'Year parameter required' },
      { status: 400 },
    )
  }

  // ------------ Fetch Acuity token ------------
  const { data: tokenRow } = await supabase
    .from('acuity_tokens')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!tokenRow) {
    return NextResponse.json(
      { error: 'No Acuity connection found' },
      { status: 400 },
    )
  }

  let accessToken = tokenRow.access_token
  const nowSec = Math.floor(Date.now() / 1000)

  if (tokenRow.expires_at && tokenRow.expires_at < nowSec) {
    try {
      const refreshRes = await fetch(
        'https://acuityscheduling.com/oauth2/token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: tokenRow.refresh_token,
            client_id: process.env.ACUITY_CLIENT_ID!,
            client_secret: process.env.ACUITY_CLIENT_SECRET!,
          }),
        },
      )

      const newTokens = await refreshRes.json()

      if (refreshRes.ok) {
        accessToken = newTokens.access_token
        await supabase
          .from('acuity_tokens')
          .update({
            access_token: newTokens.access_token,
            refresh_token: newTokens.refresh_token ?? tokenRow.refresh_token,
            expires_at: nowSec + newTokens.expires_in,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
      } else {
        return NextResponse.json(
          { error: 'Token refresh failed', details: newTokens },
          { status: 500 },
        )
      }
    } catch (err) {
      return NextResponse.json(
        { error: 'Failed to refresh token', details: String(err) },
        { status: 500 },
      )
    }
  }

  // ------------ Get barber profile (calendar) ------------
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('calendar')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    console.log(profileError)
    return NextResponse.json({ error: 'No profile found' }, { status: 400 })
  }

  const barberCalendarName = (profile.calendar || '').trim().toLowerCase()

  // ------------ Fetch calendars ------------
  let allCalendars: any[] = []
  try {
    const calRes = await fetch(
      'https://acuityscheduling.com/api/v1/calendars',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!calRes.ok) {
      throw new Error(`Calendars fetch failed: ${calRes.status}`)
    }
    allCalendars = await calRes.json()
  } catch (err) {
    console.error('Failed to fetch calendars:', err)
    return NextResponse.json(
      { error: 'Failed to fetch calendars', details: String(err) },
      { status: 500 },
    )
  }

  const calendarMatch = allCalendars.find(
    (c) => c.name.trim().toLowerCase() === barberCalendarName,
  )

  if (!calendarMatch || !calendarMatch.id) {
    return NextResponse.json(
      { error: `No matching calendar found for barber: ${barberCalendarName}` },
      { status: 400 },
    )
  }

  const calendarID = calendarMatch.id

  // ------------ Fetch appointments ------------
  const allAppointments: any[] = []

  if (!(requestedMonth == 'year' || requestedMonth == 'Q1' || requestedMonth == 'Q2' || requestedMonth == 'Q3' || requestedMonth == 'Q4')) {
    const month = MONTH_INDEX[requestedMonth!]
    const start = new Date(requestedYear, month, 1)
      .toISOString()
      .split('T')[0]
    const end = new Date(requestedYear, month + 1, 0)
      .toISOString()
      .split('T')[0]

    const url = new URL('https://acuityscheduling.com/api/v1/appointments')
    url.searchParams.set('minDate', start)
    url.searchParams.set('maxDate', end)
    url.searchParams.set('calendarID', calendarID.toString())
    url.searchParams.set('max', '2000')

    try {
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) {
        throw new Error(
          `Failed fetching appointments for ${month + 1}: ${res.statusText}`,
        )
      }
      const monthAppointments = await res.json()
      if (Array.isArray(monthAppointments)) {
        allAppointments.push(...monthAppointments)
      }
    } catch (err) {
      console.error(`Failed to fetch appointments for month ${month + 1}:`, err)
    }
  } else {
    for (let month = 0; month < 12; month++) {
      const start = new Date(requestedYear, month, 1)
        .toISOString()
        .split('T')[0]
      const end = new Date(requestedYear, month + 1, 0)
        .toISOString()
        .split('T')[0]

      const url = new URL('https://acuityscheduling.com/api/v1/appointments')
      url.searchParams.set('minDate', start)
      url.searchParams.set('maxDate', end)
      url.searchParams.set('calendarID', calendarID.toString())
      url.searchParams.set('max', '2000')

      try {
        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (!res.ok) {
          throw new Error(
            `Failed fetching appointments for ${month + 1}: ${res.statusText}`,
          )
        }
        const monthAppointments = await res.json()
        if (Array.isArray(monthAppointments)) {
          allAppointments.push(...monthAppointments)
        }
      } catch (err) {
        console.error(`Failed to fetch appointments for month ${month + 1}:`, err)
      }
    }
  }

  const now = new Date()
  const appointments = allAppointments.filter(
    (a) => new Date(a.datetime) <= now,
  )

  // ------------ Load earliest first_appt per identity from acuity_clients ------------
  const { data: clientRows, error: clientErr } = await supabase
    .from('acuity_clients')
    .select('email, phone, first_name, last_name, first_appt')
    .eq('user_id', user.id)

  if (clientErr) {
    console.error('Error loading acuity_clients for funnels:', clientErr)
  }

  const firstApptLookup: Record<string, string> = {}

  clientRows?.forEach((row) => {
    const emailKey = (row.email || '').toLowerCase().trim() || null
    const phoneKey = normalizePhone(row.phone || '') || null
    const nameKey =
      `${(row.first_name || '').trim().toLowerCase()} ${(row.last_name || '')
        .trim()
        .toLowerCase()}`.trim() || null

    const keys = [emailKey, phoneKey, nameKey].filter(Boolean) as string[]
    for (const k of keys) {
      if (!row.first_appt) continue
      if (!firstApptLookup[k] || row.first_appt < firstApptLookup[k]) {
        firstApptLookup[k] = row.first_appt
      }
    }
  })

  // ------------ Define timeframes (monthly + weekly if monthly request) ------------
  const tfDefs: TimeframeDef[] = []
  
  // Add year and quarters for yearly requests
  if (!requestedMonth || requestedMonth == 'year' || requestedMonth == 'Q1' || requestedMonth == 'Q2' || requestedMonth == 'Q3' || requestedMonth == 'Q4') {
    tfDefs.push(
      {
        id: 'year',
        startISO: `${requestedYear}-01-01`,
        endISO: `${requestedYear}-12-31`,
      },
      {
        id: 'Q1',
        startISO: `${requestedYear}-01-01`,
        endISO: `${requestedYear}-03-31`,
      },
      {
        id: 'Q2',
        startISO: `${requestedYear}-04-01`,
        endISO: `${requestedYear}-06-30`,
      },
      {
        id: 'Q3',
        startISO: `${requestedYear}-07-01`,
        endISO: `${requestedYear}-09-30`,
      },
      {
        id: 'Q4',
        startISO: `${requestedYear}-10-01`,
        endISO: `${requestedYear}-12-31`,
      }
    )
  }

  // Add all months
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  for (let m = 0; m < 12; m++) {
    const monthName = MONTHS[m]
    const start = new Date(requestedYear, m, 1)
    const end = new Date(requestedYear, m + 1, 0)
    
    tfDefs.push({
      id: monthName,
      startISO: start.toISOString().split('T')[0],
      endISO: end.toISOString().split('T')[0],
    })
  }

  // Add weeks if this is a monthly request
  const weekTimeframes: TimeframeDef[] = []
  if (requestedMonth && Object.keys(MONTH_INDEX).includes(requestedMonth)) {
    const monthIndex = MONTH_INDEX[requestedMonth]
    const monthStart = new Date(requestedYear, monthIndex, 1)
    const monthEnd = new Date(requestedYear, monthIndex + 1, 0)

    // Helper to get Monday of the week
    const getMondayStart = (d: Date) => {
      const date = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      const dayOfWeek = date.getDay()
      const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek
      const daysToSubtract = isoDay - 1
      const monday = new Date(date)
      monday.setDate(date.getDate() - daysToSubtract)
      monday.setHours(0, 0, 0, 0)
      return monday
    }

    const toISODate = (d: Date) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }

    const getFirstMondayOfMonth = (monthIndex: number, year: number) => {
      const first = new Date(year, monthIndex, 1)
      const day = first.getDay()
      const diff = day === 0 ? 1 : (8 - day) % 7
      const monday = new Date(first)
      monday.setDate(first.getDate() + diff)
      monday.setHours(0, 0, 0, 0)
      return monday
    }

    const getWeekNumberForWeekStart = (weekStartDate: Date) => {
      const monthIndex = weekStartDate.getMonth()
      const year = weekStartDate.getFullYear()
      let firstMonday = getFirstMondayOfMonth(monthIndex, year)
      if (weekStartDate < firstMonday) {
        const prevMonthDate = new Date(year, monthIndex - 1, 1)
        firstMonday = getFirstMondayOfMonth(prevMonthDate.getMonth(), prevMonthDate.getFullYear())
      }
      const diffDays = Math.round(
        (weekStartDate.getTime() - firstMonday.getTime()) / (1000 * 60 * 60 * 24)
      )
      const weekOffset = diffDays >= 0 ? Math.floor(diffDays / 7) : 0
      return weekOffset + 1
    }

    const weekMetaMap: Record<string, any> = {}
    
    for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
      const weekStart = getMondayStart(d)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)
      
      const weekStartDay = Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate())
      const monthStartDay = Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), monthStart.getUTCDate())
      const monthEndDay = Date.UTC(monthEnd.getUTCFullYear(), monthEnd.getUTCMonth(), monthEnd.getUTCDate())

      if (weekStartDay >= monthStartDay && weekStartDay <= monthEndDay) {
        const weekNumber = getWeekNumberForWeekStart(weekStart)
        const weekKey = `week-${weekNumber}`

        if (!weekMetaMap[weekKey]) {
          weekMetaMap[weekKey] = {
            weekStartISO: toISODate(weekStart),
            weekEndISO: toISODate(weekEnd),
            weekNumber,
            month: requestedMonth,
            year: requestedYear,
          }
          weekTimeframes.push({
            id: weekKey,
            startISO: toISODate(weekStart),
            endISO: toISODate(weekEnd),
          })
        }
      }
    }

    // Add week timeframes to tfDefs for computation
    tfDefs.push(...weekTimeframes)
  }

  // ------------ Aggregation structures ------------
  const funnels: Record<string, Record<string, FunnelStats>> = {}
  const clientVisits: Record<string, { dateISO: string; price: number }[]> = {}
  const clientIdentity: Record<string, { email: string; phone: string; nameKey: string }> = {}
  const clientSource: Record<string, string> = {}

  // ------------ PASS 1: Collect visits, identity, and sources ------------
  for (const appt of appointments) {
    const apptDateISO = appt.datetime.split('T')[0]
    const price = parseFloat(appt.priceSold || '0')

    const email = (appt.email || '').toLowerCase().trim()
    const phone = normalizePhone(appt.phone)
    const nameKey = `${appt.firstName || ''} ${appt.lastName || ''}`
      .trim()
      .toLowerCase()

    if (!email && !phone && !nameKey) continue

    const clientKey = buildClientKey(appt, user.id)

    if (!clientVisits[clientKey]) {
      clientVisits[clientKey] = []
    }
    clientVisits[clientKey].push({ dateISO: apptDateISO, price })

    clientIdentity[clientKey] = { email, phone, nameKey }

    // Only set source once per client (first occurrence)
    if (!clientSource[clientKey]) {
      const extracted = extractSourceFromForms(appt.forms || [])
      if (extracted) {
        clientSource[clientKey] = extracted
      }
    }
  }

  // ------------ PASS 2: Classify clients and compute stats per timeframe ------------
  for (const [clientKey, visits] of Object.entries(clientVisits)) {
    const source = clientSource[clientKey]
    if (!source) continue

    const identity = clientIdentity[clientKey]
    const idKeys = [
      identity?.email || '',
      identity?.phone || '',
      identity?.nameKey || '',
    ].filter(Boolean) as string[]

    // Look up first_appt from database
    let firstAppt: string | null = null
    for (const k of idKeys) {
      const fa = firstApptLookup[k]
      if (fa && (!firstAppt || fa < firstAppt)) {
        firstAppt = fa
      }
    }

    // Skip if not found in database
    if (!firstAppt) continue

    const sortedVisits = [...visits].sort((a, b) =>
      a.dateISO.localeCompare(b.dateISO),
    )

    const secondAppt = sortedVisits.length > 1 ? sortedVisits[1].dateISO : null

    // Prepare display name for client_names
    const displayName = identity.nameKey.trim() || identity.email || identity.phone
    
    // Process each timeframe
    for (const tf of tfDefs) {
      if (requestedMonth && requestedMonth != tf.id && !tf.id.startsWith('week-')) continue

      const isFirstApptInTimeframe = firstAppt >= tf.startISO && firstAppt <= tf.endISO
      const isFirstApptBeforeTimeframe = firstAppt < tf.startISO

      // Skip if neither new nor returning in this timeframe
      if (!isFirstApptInTimeframe && !isFirstApptBeforeTimeframe) continue

      // Skip returning clients for weekly breakdown
      if (isFirstApptBeforeTimeframe && tf.id.startsWith('week-')) continue

      // Get visits within this timeframe
      const visitsInTimeframe = visits.filter(
        v => v.dateISO >= tf.startISO && v.dateISO <= tf.endISO
      )

      // Skip if no visits in this timeframe
      if (visitsInTimeframe.length === 0) continue

      // Log client info (except "Returning Client")
      if (source !== 'Returning Client' && firstAppt.startsWith('2025-12') ) {
        console.log(`${identity.nameKey.padEnd(30)} | First visit: ${firstAppt} | Source: ${source.padEnd(15)} | Timeframe: ${tf.id}`)
      }

      // (tf.id).startsWith('week')

      // Initialize funnel structures
      if (!funnels[tf.id]) {
        funnels[tf.id] = {}
      }
      if (!funnels[tf.id][source]) {
        funnels[tf.id][source] = {
          new_clients: 0,
          returning_clients: 0,
          new_clients_retained: 0,
          total_revenue: 0,
          total_visits: 0,
        }
      }

      const stats = funnels[tf.id][source]

      // Add revenue and visits for this timeframe
      for (const visit of visitsInTimeframe) {
        stats.total_revenue += visit.price
        stats.total_visits += 1
      }

      // Classify as new or returning
      if (isFirstApptInTimeframe) {
        stats.new_clients += 1

        // Add client name and first visit to list
        if (!stats.client_names) {
          stats.client_names = []
        }
        const clientExists = stats.client_names.some((c: any) => c.client_name === displayName)
        if (displayName && !clientExists) {
          stats.client_names.push({
            client_name: displayName,
            first_visit: firstAppt
          })
        }

        // Check if new client returned within the same timeframe
        if (secondAppt && secondAppt > firstAppt && secondAppt <= tf.endISO) {
          stats.new_clients_retained += 1
        }
      } else if (isFirstApptBeforeTimeframe) {
        stats.returning_clients += 1
      }
    }
  }

  // ------------ Build upserts for monthly/yearly funnels ------------
  const upserts: any[] = []

  if (requestedMonth && Object.keys(MONTH_INDEX).includes(requestedMonth)) {
    // Monthly request
    const tfStats = funnels[requestedMonth]
    if (tfStats) {
      for (const [source, stats] of Object.entries(tfStats)) {
        if (source === 'Returning Client') continue
        if (stats.new_clients === 0) continue

        const retention =
          stats.new_clients > 0
            ? (stats.new_clients_retained / stats.new_clients) * 100
            : 0
        const avg_ticket =
          stats.total_visits > 0
            ? stats.total_revenue / stats.total_visits
            : 0

        upserts.push({
          user_id: user.id,
          source,
          report_month: requestedMonth,
          new_clients: stats.new_clients,
          returning_clients: stats.returning_clients,
          new_clients_retained: stats.new_clients_retained,
          retention,
          avg_ticket,
          report_year: requestedYear,
          created_at: new Date().toISOString(),
          client_names: stats.client_names || [],
        })
      }
    }
  } else {
    // Yearly/Quarterly request
    for (const tf of tfDefs) {
      if (tf.id.startsWith('week-')) continue // Skip weeks for yearly table
      
      const tfStats = funnels[tf.id]
      if (!tfStats) continue

      for (const [source, stats] of Object.entries(tfStats)) {
        if (source === 'Returning Client') continue
        if (stats.new_clients === 0) continue

        const retention =
          stats.new_clients > 0
            ? (stats.new_clients_retained / stats.new_clients) * 100
            : 0
        const avg_ticket =
          stats.total_visits > 0
            ? stats.total_revenue / stats.total_visits
            : 0

        upserts.push({
          user_id: user.id,
          source,
          timeframe: tf.id,
          new_clients: stats.new_clients,
          returning_clients: stats.returning_clients,
          new_clients_retained: stats.new_clients_retained,
          retention,
          avg_ticket,
          report_year: requestedYear,
          created_at: new Date().toISOString(),
        })
      }
    }
  }

  // ------------ Build upserts for weekly funnels (if monthly request) ------------
  const weeklyUpserts: any[] = []

  if (requestedMonth && Object.keys(MONTH_INDEX).includes(requestedMonth)) {
    for (const tf of weekTimeframes) {
      const weekNumber = parseInt(tf.id.split('-')[1])
      const tfStats = funnels[tf.id]
      if (!tfStats) continue

      for (const [source, stats] of Object.entries(tfStats)) {
        if (source === 'Returning Client') continue
        if (stats.new_clients === 0) continue

        const retention =
          stats.new_clients > 0
            ? (stats.new_clients_retained / stats.new_clients) * 100
            : 0
        const avg_ticket =
          stats.total_visits > 0
            ? stats.total_revenue / stats.total_visits
            : 0

        weeklyUpserts.push({
          user_id: user.id,
          source,
          week_number: weekNumber,
          report_month: requestedMonth,
          report_year: requestedYear,
          new_clients: stats.new_clients,
          returning_clients: stats.returning_clients,
          new_clients_retained: stats.new_clients_retained,
          retention,
          avg_ticket,
          updated_at: new Date().toISOString(),
          client_names: stats.client_names || [],
        })
      }
    }
  }

  // ------------ Upsert to database ------------
  const isMonthlyRequest = requestedMonth && Object.keys(MONTH_INDEX).includes(requestedMonth)
  
  if (isMonthlyRequest) {
    // Upsert monthly funnels
    if (upserts.length > 0) {
      const { error: upsertErr } = await supabase
        .from('marketing_funnels')
        .upsert(upserts, {
          onConflict: 'user_id, source, report_month, report_year',
        })

      if (upsertErr) {
        console.error('Error upserting marketing_funnels:', upsertErr)
        return NextResponse.json(
          { success: false, error: upsertErr.message },
          { status: 500 },
        )
      }
    }

    // Upsert weekly funnels
    if (weeklyUpserts.length > 0) {
      const { error: weeklyErr } = await supabase
        .from('weekly_marketing_funnels_base')
        .upsert(weeklyUpserts, {
          onConflict: 'user_id,source,week_number,report_month,report_year',
        })

      if (weeklyErr) {
        console.error('Error upserting weekly_marketing_funnels_base:', weeklyErr)
        return NextResponse.json(
          { success: false, error: weeklyErr.message },
          { status: 500 },
        )
      }
    }
  } else {
    // Upsert yearly funnels
    if (upserts.length > 0) {
      const { error: upsertErr } = await supabase
        .from('yearly_marketing_funnels')
        .upsert(upserts, {
          onConflict: 'user_id,source,report_year,timeframe',
        })

      if (upsertErr) {
        console.error('Error upserting yearly_marketing_funnels:', upsertErr)
        return NextResponse.json(
          { success: false, error: upsertErr.message },
          { status: 500 },
        )
      }
    }
  }

  return NextResponse.json({
    success: true,
    year: requestedYear,
    month: requestedMonth,
    totalAppointments: allAppointments.length,
    totalMonthlyRows: upserts.length,
    totalWeeklyRows: weeklyUpserts.length,
  })
}