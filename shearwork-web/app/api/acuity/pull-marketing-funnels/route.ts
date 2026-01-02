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

  // ------------ Fetch appointments for the whole year ------------
  const allAppointments: any[] = []


  if (!(requestedMonth == 'year' || requestedMonth == 'Q1' || requestedMonth == 'Q2' || requestedMonth == 'Q3' || requestedMonth == 'Q4')){
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

  }else {

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
    const emailKey =
      (row.email || '').toLowerCase().trim() || null
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

  // ------------ Define timeframes (year + quarters) ------------
  const tfDefs: TimeframeDef[] = [
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
    },
    {
      id: 'January',
      startISO: `${requestedYear}-01-01`,
      endISO: `${requestedYear}-01-31`,
    },
    {
      id: 'February',
      startISO: `${requestedYear}-02-01`,
      endISO: `${requestedYear}-02-28`,
    },
    {
      id: 'March',
      startISO: `${requestedYear}-03-01`,
      endISO: `${requestedYear}-03-31`,
    },
    {
      id: 'April',
      startISO: `${requestedYear}-04-01`,
      endISO: `${requestedYear}-04-30`,
    },
    {
      id: 'May',
      startISO: `${requestedYear}-05-01`,
      endISO: `${requestedYear}-05-31`,
    },
    {
      id: 'June',
      startISO: `${requestedYear}-06-01`,
      endISO: `${requestedYear}-06-30`,
    },
    {
      id: 'July',
      startISO: `${requestedYear}-07-01`,
      endISO: `${requestedYear}-07-31`,
    },
    {
      id: 'August',
      startISO: `${requestedYear}-08-01`,
      endISO: `${requestedYear}-08-31`,
    },
    {
      id: 'September',
      startISO: `${requestedYear}-09-01`,
      endISO: `${requestedYear}-09-30`,
    },
    {
      id: 'October',
      startISO: `${requestedYear}-10-01`,
      endISO: `${requestedYear}-10-31`,
    },
    {
      id: 'November',
      startISO: `${requestedYear}-11-01`,
      endISO: `${requestedYear}-11-30`,
    },
    {
      id: 'December',
      startISO: `${requestedYear}-12-01`,
      endISO: `${requestedYear}-12-31`,
    }
  ]

  // ------------ Aggregation structures ------------
  const funnels: Record<string, Record<string, FunnelStats>> = {}
  const clientVisits: Record<
    string,
    { dateISO: string; price: number }[]
  > = {}
  const clientIdentity: Record<
    string,
    { email: string; phone: string; nameKey: string }
  > = {}
  const clientSource: Record<string, string> = {}

  // ------------ First pass: collect visits and revenue per timeframe ------------
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

    let source = clientSource[clientKey]
    if (!source) {
      const extracted = extractSourceFromForms(appt.forms || [])
      if (extracted) {
        clientSource[clientKey] = extracted
        source = extracted
      }
    }

    if (!source) continue

    for (const tf of tfDefs) {
      if (requestedMonth && requestedMonth != tf.id) continue
      if (apptDateISO >= tf.startISO && apptDateISO <= tf.endISO) {
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
        stats.total_revenue += price
        stats.total_visits += 1
      }
    }
  }

  // ------------ Second pass: compute new and returning per timeframe ------------
  for (const [clientKey, visits] of Object.entries(clientVisits)) {
    const source = clientSource[clientKey]
    if (!source) continue

    const identity = clientIdentity[clientKey]
    const idKeys = [
      identity?.email || '',
      identity?.phone || '',
      identity?.nameKey || '',
    ].filter(Boolean) as string[]

    let firstAppt: string | null = null

    for (const k of idKeys) {
      const fa = firstApptLookup[k]
      if (fa && (!firstAppt || fa < firstAppt)) {
        firstAppt = fa
      }
    }

    const sortedVisits = [...visits].sort((a, b) =>
      a.dateISO.localeCompare(b.dateISO),
    )

    if (!firstAppt && sortedVisits.length > 0) {
      firstAppt = sortedVisits[0].dateISO
    }

    const secondAppt =
      sortedVisits.length > 1 ? sortedVisits[1].dateISO : null

    if (!firstAppt) continue

    for (const tf of tfDefs) {
      if (requestedMonth && requestedMonth != tf.id) continue
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

      const isFirstApptInTimeframe = firstAppt >= tf.startISO && firstAppt <= tf.endISO

      if (isFirstApptInTimeframe) {
        stats.new_clients += 1
      }

      // Check if new client returned within the same timeframe
      let isNewClientRetained = false
      if (secondAppt) {
        if (
          isFirstApptInTimeframe &&
          secondAppt > firstAppt &&
          secondAppt <= tf.endISO
        ) {
          isNewClientRetained = true
        }
      }

      if (isNewClientRetained) {
        stats.returning_clients += 1
        stats.new_clients_retained += 1
      }
    }
  }

  // ------------ Build upserts for yearly_marketing_funnels ------------
  // ------------ Build upserts for yearly_marketing_funnels ------------
  const upserts: any[] = []

  if (requestedMonth){
    const tfStats = funnels[requestedMonth]
    if (tfStats){

      for (const [source, stats] of Object.entries(tfStats)) {
        // Skip "Returning Client" source
        if (source === 'Returning Client') continue

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
          timeframe: requestedMonth,
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
  } else {
    for (const tf of tfDefs) {
      const tfStats = funnels[tf.id]
      if (!tfStats) continue

      for (const [source, stats] of Object.entries(tfStats)) {
        // Skip "Returning Client" source
        if (source === 'Returning Client') continue

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

  if (upserts.length === 0) {
    return NextResponse.json({
      success: true,
      year: requestedYear,
      message: 'No funnels to upsert (no attributed sources)',
    })
  }


  const isMonthlyRequest = requestedMonth && Object.keys(MONTH_INDEX).includes(requestedMonth)
  
  if (isMonthlyRequest) {
    const { error: upsertErr } = await supabase
      .from('marketing_funnels')
      .upsert(upserts, {
        onConflict: 'user_id,source,report_year,report_month',
      })

    if (upsertErr) {
      console.error('Error upserting marketing_funnels:', upsertErr)
      return NextResponse.json(
        { success: false, error: upsertErr.message },
        { status: 500 },
      )
    }
  } else {
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

  return NextResponse.json({
    success: true,
    year: requestedYear,
    totalAppointments: allAppointments.length,
    totalRows: upserts.length,
  })
}