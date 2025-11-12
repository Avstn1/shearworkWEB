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

function buildClientKey(client: any) {
  const email = (client.email || '').toLowerCase().trim()
  const phone = normalizePhone(client.phone)
  const name = `${client.firstName || ''} ${client.lastName || ''}`.trim().toLowerCase()
  const raw = email || phone || name
  if (raw) return raw

  // fallback for missing identifiers → deterministic internal ID
  const seed = `${client.id || ''}|${client.datetime || ''}|${client.firstName || ''}|${client.lastName || ''}`
  return crypto.createHash('sha256').update(seed).digest('hex')
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const requestedYear = searchParams.get('year') ? parseInt(searchParams.get('year') as string, 10) : null
  if (!requestedYear) return NextResponse.json({ error: 'Year parameter required' }, { status: 400 })

  // Fetch token
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

  // ---------------- Helper to fetch a single day's appointments ----------------
  async function fetchDay(date: string) {
    const url = new URL('https://acuityscheduling.com/api/v1/appointments')
    url.searchParams.set('minDate', date)
    url.searchParams.set('maxDate', date)
    url.searchParams.set('max', '2000') // fetch max per day
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!res.ok) throw new Error(`Failed fetching appointments for ${date}: ${res.statusText}`)
    return res.json()
  }

  // ---------------- Fetch every day of the year ----------------
  let allAppointments: any[] = []
  const start = new Date(requestedYear, 0, 1)
  const end = new Date(requestedYear, 11, 31)

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayStr = d.toISOString().split('T')[0]
    try {
      const dayAppointments = await fetchDay(dayStr)
      if (Array.isArray(dayAppointments)) allAppointments.push(...dayAppointments)
    } catch (err) {
      console.error(`Failed to fetch appointments for ${dayStr}:`, err)
    }
  }

  // ---------------- Aggregate clients ----------------
  const clientMap: Record<string, any> = {}
  for (const appt of allAppointments) {
    const key = buildClientKey(appt)
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
        user_id: user.id // ✅ associate with current barber
      }
    }

    clientMap[key].total_appointments++
  }

  const upserts = Object.values(clientMap)

  // ---------------- Upsert into Supabase ----------------
  const { error: upsertErr } = await supabase.from('acuity_clients').upsert(upserts, {
    onConflict: 'user_id,client_id' // ✅ uniqueness per user
  })
  if (upsertErr) return NextResponse.json({ success: false, error: upsertErr.message }, { status: 500 })

  return NextResponse.json({ 
    success: true, 
    year: requestedYear, 
    totalAppointments: allAppointments.length, 
    totalClients: upserts.length 
  })
}
