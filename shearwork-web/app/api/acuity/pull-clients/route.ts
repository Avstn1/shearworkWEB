'use server'

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import crypto from 'crypto'

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
  if (raw) return `${userId}_${raw}`  // prefix userId for global uniqueness

  // fallback for missing identifiers → deterministic internal ID
  const seed = `${userId}|${client.id || ''}|${client.datetime || ''}|${client.firstName || ''}|${client.lastName || ''}`
  return crypto.createHash('sha256').update(seed).digest('hex')
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const requestedYear = searchParams.get('year') ? parseInt(searchParams.get('year') as string, 10) : null
  if (!requestedYear) return NextResponse.json({ error: 'Year parameter required' }, { status: 400 })

  // Fetch Acuity token
  const { data: tokenRow } = await supabase.from('acuity_tokens').select('*').eq('user_id', user.id).single()
  if (!tokenRow) return NextResponse.json({ error: 'No Acuity connection found' }, { status: 400 })

  let accessToken = tokenRow.access_token
  const nowSec = Math.floor(Date.now() / 1000)

  // Refresh token if expired
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
        await supabase.from('acuity_tokens').update({
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token ?? tokenRow.refresh_token,
          expires_at: nowSec + newTokens.expires_in,
          updated_at: new Date().toISOString(),
        }).eq('user_id', user.id)
      } else {
        return NextResponse.json({ error: 'Token refresh failed', details: newTokens }, { status: 500 })
      }
    } catch (err) {
      return NextResponse.json({ error: 'Failed to refresh token', details: String(err) })
    }
  }

  // ------------------- Get barber profile -------------------------
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("calendar")
    .eq("user_id", user.id)
    .single()
  if (profileError || !profile) {
    console.log(profileError)
    return NextResponse.json({ error: "No profile found" }, { status: 400 })
  }

  const barberCalendarName = (profile.calendar || "").trim().toLowerCase()

  // ------------------- Fetch calendars ----------------------------
  let allCalendars: any[] = []
  try {
    const calRes = await fetch('https://acuityscheduling.com/api/v1/calendars', {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    if (!calRes.ok) throw new Error(`Calendars fetch failed: ${calRes.status}`)
    allCalendars = await calRes.json()
  } catch (err) {
    console.error('Failed to fetch calendars:', err)
    return NextResponse.json({ error: 'Failed to fetch calendars', details: String(err) }, { status: 500 })
  }

  const calendarMatch = allCalendars.find(c => c.name.trim().toLowerCase() === barberCalendarName)
  if (!calendarMatch || !calendarMatch.id) {
    return NextResponse.json({ error: `No matching calendar found for barber: ${barberCalendarName}` }, { status: 400 })
  }
  const calendarID = calendarMatch.id

  // ------------------- Fetch appointments by month -----------------
  const allAppointments: any[] = []
  for (let month = 0; month < 12; month++) {
    const start = new Date(requestedYear, month, 1).toISOString().split('T')[0]
    const end = new Date(requestedYear, month + 1, 0).toISOString().split('T')[0] // last day of month

    const url = new URL('https://acuityscheduling.com/api/v1/appointments')
    url.searchParams.set('minDate', start)
    url.searchParams.set('maxDate', end)
    url.searchParams.set('calendarID', calendarID.toString())
    url.searchParams.set('max', '2000')

    try {
      const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } })
      if (!res.ok) throw new Error(`Failed fetching appointments for ${month + 1}: ${res.statusText}`)
      const monthAppointments = await res.json()
      if (Array.isArray(monthAppointments)) allAppointments.push(...monthAppointments)
      console.log(`Month ${month + 1} processed: ${monthAppointments.length} appointments fetched`)
    } catch (err) {
      console.error(`Failed to fetch appointments for month ${month + 1}:`, err)
    }
  }

  // ------------------- Filter past appointments -------------------
  const now = new Date()
  const appointments = allAppointments.filter(a => new Date(a.datetime) <= now)

  // ------------------- Aggregate clients ---------------------------
  const clientMap: Record<string, any> = {}
  for (const appt of appointments) {
    const key = buildClientKey(appt, user.id)
    if (!key) continue

    if (!clientMap[key]) {
      clientMap[key] = {
        client_id: key,
        first_name: appt.firstName || '',
        last_name: appt.lastName || '',
        email: (appt.email || '').toLowerCase().trim(),
        phone: normalizePhone(appt.phone),
        notes: appt.notes || '',
        total_appointments: 0,
        user_id: user.id
      }
    }

    clientMap[key].total_appointments++
  }

  const upserts = Object.values(clientMap)

  // ------------------- Upsert into Supabase ------------------------
  const { error: upsertErr } = await supabase.from('acuity_clients').upsert(upserts, {
    onConflict: 'user_id,client_id'
  })
  if (upsertErr) return NextResponse.json({ success: false, error: upsertErr.message }, { status: 500 })

  return NextResponse.json({
    success: true,
    year: requestedYear,
    totalAppointments: allAppointments.length,
    totalClients: upserts.length
  })
}
