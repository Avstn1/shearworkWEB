'use server'

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import crypto from 'crypto'
import { getAuthenticatedUser } from '@/utils/api-auth'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

function normalizePhone(phone?: string) {
  return phone ? phone.replace(/\D/g, '') : ''
}

function buildClientKey(client: any, userId: string) {
  const email = (client.email || '').toLowerCase().trim()
  const phone = normalizePhone(client.phone)
  const name = `${client.firstName || ''} ${client.lastName || ''}`.trim().toLowerCase()
  const raw = email || phone || name
  if (raw) return `${userId}_${raw}`

  // fallback for missing identifiers → deterministic internal ID
  const seed = `${userId}|${client.id || ''}|${client.datetime || ''}|${client.firstName || ''}|${client.lastName || ''}`
  return crypto.createHash('sha256').update(seed).digest('hex')
}

const REFERRAL_KEYWORDS = [
  'referral',
  'referred',
  'hear',
  'heard',
  'source',
  'social',
  'instagram',
  'facebook',
  'tiktok',
  'walking',
  'walk'
]

const REFERRAL_FILTER = ['unknown', 'returning', 'return', 'returning client']

function extractSourceFromForms(forms: any[]): string | null {
  if (!forms || !Array.isArray(forms)) return null

  for (const form of forms) {
    if (!form?.values || !Array.isArray(form.values)) continue

    for (const field of form.values) {
      const fieldName = field.name?.toLowerCase() || ''
      const fieldValue = (field.value || '').toString().trim()

      if (!REFERRAL_KEYWORDS.some(k => fieldName.includes(k))) continue
      if (!fieldValue || fieldValue.includes(',')) continue

      const valueLower = fieldValue.toLowerCase()
      if (REFERRAL_FILTER.some(k => valueLower.includes(k))) continue

      return fieldValue // keep raw text
    }
  }

  return null
}

type TimeframeDef = {
  id: string // 'year', 'Q1', ...
  startISO: string // 'YYYY-MM-DD'
  endISO: string
}

type FunnelStats = {
  new_clients: number
  returning_clients: number
  total_revenue: number
  total_visits: number
}

export async function GET(request: Request) {
  const { user, supabase } = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const requestedYear = searchParams.get('year')
    ? parseInt(searchParams.get('year') as string, 10)
    : null
  if (!requestedYear) {
    return NextResponse.json({ error: 'Year parameter required' }, { status: 400 })
  }

  // ------------ Fetch Acuity token ------------
  const { data: tokenRow } = await supabase
    .from('acuity_tokens')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!tokenRow)
    return NextResponse.json({ error: 'No Acuity connection found' }, { status: 400 })

  let accessToken = tokenRow.access_token
  const nowSec = Math.floor(Date.now() / 1000)

  if (tokenRow.expires_at && tokenRow.expires_at < nowSec) {
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
            expires_at: nowSec + newTokens.expires_in,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
      } else {
        return NextResponse.json(
          { error: 'Token refresh failed', details: newTokens },
          { status: 500 }
        )
      }
    } catch (err) {
      return NextResponse.json(
        { error: 'Failed to refresh token', details: String(err) },
        { status: 500 }
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
    const calRes = await fetch('https://acuityscheduling.com/api/v1/calendars', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!calRes.ok) throw new Error(`Calendars fetch failed: ${calRes.status}`)
    allCalendars = await calRes.json()
  } catch (err) {
    console.error('Failed to fetch calendars:', err)
    return NextResponse.json(
      { error: 'Failed to fetch calendars', details: String(err) },
      { status: 500 }
    )
  }

  const calendarMatch = allCalendars.find(
    (c) => c.name.trim().toLowerCase() === barberCalendarName
  )
  if (!calendarMatch || !calendarMatch.id) {
    return NextResponse.json(
      { error: `No matching calendar found for barber: ${barberCalendarName}` },
      { status: 400 }
    )
  }
  const calendarID = calendarMatch.id

  // ------------ Fetch appointments for the whole year ------------
  const allAppointments: any[] = []
  for (let month = 0; month < 12; month++) {
    const start = new Date(requestedYear, month, 1).toISOString().split('T')[0]
    const end = new Date(requestedYear, month + 1, 0).toISOString().split('T')[0]

    const url = new URL('https://acuityscheduling.com/api/v1/appointments')
    url.searchParams.set('minDate', start)
    url.searchParams.set('maxDate', end)
    url.searchParams.set('calendarID', calendarID.toString())
    url.searchParams.set('max', '2000')

    try {
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok)
        throw new Error(`Failed fetching appointments for ${month + 1}: ${res.statusText}`)
      const monthAppointments = await res.json()
      if (Array.isArray(monthAppointments)) allAppointments.push(...monthAppointments)
      console.log(
        `Month ${month + 1} processed: ${monthAppointments.length} appointments fetched`
      )
    } catch (err) {
      console.error(`Failed to fetch appointments for month ${month + 1}:`, err)
    }
  }

  const now = new Date()
  const appointments = allAppointments.filter((a) => new Date(a.datetime) <= now)

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
    const nameKey = `${(row.first_name || '').trim().toLowerCase()} ${(row.last_name || '')
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
  ]

  // ------------ Aggregation structures ------------
  const funnels: Record<string, Record<string, FunnelStats>> = {} // timeframe -> source -> stats
  const clientVisits: Record<
    string,
    { dateISO: string; price: number }[]
  > = {} // clientKey -> visits (this year only)
  const clientIdentity: Record<
    string,
    { email: string; phone: string; nameKey: string }
  > = {}
  const clientSource: Record<string, string> = {} // canonical source per client

  // ------------ First pass: collect visits & revenue per timeframe ------------
  for (const appt of appointments) {
    const apptDateISO = appt.datetime.split('T')[0] // 'YYYY-MM-DD'
    const price = parseFloat(appt.priceSold || '0')

    const email = (appt.email || '').toLowerCase().trim()
    const phone = normalizePhone(appt.phone)
    const nameKey = `${appt.firstName || ''} ${appt.lastName || ''}`.trim().toLowerCase()

    if (!email && !phone && !nameKey) continue // no identity

    const clientKey = buildClientKey(appt, user.id)

    if (!clientVisits[clientKey]) clientVisits[clientKey] = []
    clientVisits[clientKey].push({ dateISO: apptDateISO, price })

    clientIdentity[clientKey] = { email, phone, nameKey }

    // Determine canonical source for this client
    let source = clientSource[clientKey]
    if (!source) {
      const extracted = extractSourceFromForms(appt.forms || [])
      if (extracted) {
        clientSource[clientKey] = extracted
        source = extracted
      }
    }

    // If we still don't know the source, we can't attribute this visit to any funnel
    if (!source) continue

    // Revenue & visits per timeframe
    for (const tf of tfDefs) {
      if (apptDateISO >= tf.startISO && apptDateISO <= tf.endISO) {
        if (!funnels[tf.id]) funnels[tf.id] = {}
        if (!funnels[tf.id][source]) {
          funnels[tf.id][source] = {
            new_clients: 0,
            returning_clients: 0,
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

  // ------------ Second pass: compute new/returning per timeframe ------------
  for (const [clientKey, visits] of Object.entries(clientVisits)) {
    const source = clientSource[clientKey]
    if (!source) continue // can't assign to a funnel

    const identity = clientIdentity[clientKey]
    const idKeys = [
      identity?.email || '',
      identity?.phone || '',
      identity?.nameKey || '',
    ].filter(Boolean) as string[]

    // Global first appointment from DB
    let firstAppt: string | null = null
    for (const k of idKeys) {
      const fa = firstApptLookup[k]
      if (fa && (!firstAppt || fa < firstAppt)) {
        firstAppt = fa
      }
    }

    // Sort this year's visits
    const sortedVisits = [...visits].sort((a, b) =>
      a.dateISO.localeCompare(b.dateISO)
    )

    // Fallback: if we didn't find first_appt in DB, use earliest visit this year
    if (!firstAppt && sortedVisits.length > 0) {
      firstAppt = sortedVisits[0].dateISO
    }

    const secondAppt = sortedVisits.length > 1 ? sortedVisits[1].dateISO : null

    if (!firstAppt) continue // extremely defensive

    for (const tf of tfDefs) {
      // Ensure stats object exists if we ever touch this (source, timeframe)
      if (!funnels[tf.id]) funnels[tf.id] = {}
      if (!funnels[tf.id][source]) {
        funnels[tf.id][source] = {
          new_clients: 0,
          returning_clients: 0,
          total_revenue: 0,
          total_visits: 0,
        }
      }
      const stats = funnels[tf.id][source]

      // ---- New client for this timeframe? ----
      if (firstAppt >= tf.startISO && firstAppt <= tf.endISO) {
        stats.new_clients += 1
      }

      // ---- Returning client for this timeframe? ----
      let isReturning = false
      if (secondAppt) {
        // // Case 1: first before timeframe, second inside timeframe
        // if (
        //   firstAppt < tf.startISO &&
        //   secondAppt >= tf.startISO &&
        //   secondAppt <= tf.endISO
        // ) {
        //   isReturning = true
        // }

        // Case 2: both first & second inside timeframe, with second after first
        if (
          firstAppt >= tf.startISO &&
          firstAppt <= tf.endISO &&
          secondAppt > firstAppt &&
          secondAppt <= tf.endISO
        ) {
          isReturning = true
        }
      }

      if (isReturning) {
        stats.returning_clients += 1
      }
    }
  }

  // ------------ Build upserts for yearly_marketing_funnels ------------
  const upserts: any[] = []

  for (const tf of tfDefs) {
    const tfStats = funnels[tf.id]
    if (!tfStats) continue

    for (const [source, stats] of Object.entries(tfStats)) {
      const retention =
        stats.new_clients > 0
          ? (stats.returning_clients / stats.new_clients) * 100
          : 0
      const avg_ticket =
        stats.total_visits > 0 ? stats.total_revenue / stats.total_visits : 0

      upserts.push({
        user_id: user.id,
        source,
        timeframe: tf.id, // 'year', 'Q1', ...
        new_clients: stats.new_clients,
        returning_clients: stats.returning_clients,
        retention,
        avg_ticket,
        report_year: requestedYear,
        created_at: new Date().toISOString(),
      })
    }
  }

  if (upserts.length === 0) {
    return NextResponse.json({
      success: true,
      year: requestedYear,
      message: 'No funnels to upsert (no attributed sources)',
    })
  }

  const { error: upsertErr } = await supabase
    .from('yearly_marketing_funnels')
    .upsert(upserts, {
      onConflict: 'user_id,source,report_year,timeframe',
    })

  if (upsertErr) {
    console.error('Error upserting yearly_marketing_funnels:', upsertErr)
    return NextResponse.json(
      { success: false, error: upsertErr.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    year: requestedYear,
    totalAppointments: allAppointments.length,
    totalRows: upserts.length,
  })
}
