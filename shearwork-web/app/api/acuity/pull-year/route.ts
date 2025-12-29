/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'
import crypto from 'crypto'
import {
  extractSourceFromForms,
  computeFunnelsFromAppointments,
  type AcuityAppointment,
  type TimeframeDef,
  type FunnelStats,
} from '@/lib/marketingFunnels'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

// -------------------- Date helpers --------------------
function getWeekdayName(date: Date) {
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return weekdays[date.getDay()]
}

function parseDateStringSafe(datetime: string | undefined | null) {
  if (!datetime) return null
  try {
    const datePart = datetime.split('T')[0]
    const [yStr, mStr, dStr] = datePart.split('-')
    const y = Number(yStr)
    const m = Number(mStr)
    const d = Number(dStr)
    if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) throw new Error('invalid parts')
    const monthName = MONTHS[m - 1] || 'Unknown'
    const dayKey = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    return { year: y, monthIndex: m, monthName, dayKey, day: d }
  } catch {
    try {
      const dt = new Date(datetime as string)
      const y = dt.getUTCFullYear()
      const m = dt.getUTCMonth() + 1
      const d = dt.getUTCDate()
      const monthName = MONTHS[m - 1] || 'Unknown'
      const dayKey = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      return { year: y, monthIndex: m, monthName, dayKey, day: d }
    } catch {
      return null
    }
  }
}

function getMondayStart(d: Date) {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dayOfWeek = date.getDay()
  const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek
  const daysToSubtract = isoDay - 1
  const monday = new Date(date)
  monday.setDate(date.getDate() - daysToSubtract)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function toISODate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getFirstMondayOfMonth(monthIndex: number, year: number) {
  const first = new Date(year, monthIndex, 1)
  const day = first.getDay()
  const diff = day === 0 ? 1 : (8 - day) % 7
  const monday = new Date(first)
  monday.setDate(first.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function getWeekNumberForWeekStart(weekStartDate: Date) {
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

function getWeekMetaForDate(dateLike: string | Date) {
  const dt = typeof dateLike === 'string' ? new Date(dateLike) : dateLike
  const weekStart = getMondayStart(dt)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  const weekMonthIndex = weekStart.getMonth()
  const weekMonthName = MONTHS[weekMonthIndex]
  const weekYear = weekStart.getFullYear()
  const weekNumber = getWeekNumberForWeekStart(weekStart)
  return {
    weekStartISO: toISODate(weekStart),
    weekEndISO: toISODate(weekEnd),
    weekNumber,
    month: weekMonthName,
    year: weekYear,
  }
}

function normEmail(email?: string | null) {
  const e = (email ?? '').toLowerCase().trim()
  return e || null
}

function normPhone(phone?: string | null) {
  const p = (phone ?? '').replace(/\D/g, '')
  return p || null
}

function normName(firstName?: string | null, lastName?: string | null) {
  const f = (firstName ?? '').trim().toLowerCase()
  const l = (lastName ?? '').trim().toLowerCase()
  const n = `${f} ${l}`.trim()
  return n || null
}

function normalizePhoneE164(phone?: string | null): string | null {
  if (!phone) return null
  const cleaned = phone.replace(/[^0-9]/g, '')
  if (/^1[0-9]{10}$/.test(cleaned)) {
    return '+' + cleaned
  } else if (/^[0-9]{10}$/.test(cleaned)) {
    return '+1' + cleaned
  } else if (cleaned.length === 11 && cleaned[0] !== '1') {
    const without_first = cleaned.substring(1)
    if (/^[0-9]{10}$/.test(without_first)) {
      return '+1' + without_first
    }
  }
  return null
}

function addUniqueClient(list: any[], appt: any) {
  const email = normEmail(appt.email)
  const phone = normPhone(appt.phone)
  const name = normName(appt.firstName ?? null, appt.lastName ?? null)

  if (!email && !phone && !name) return

  const exists = list.some((c) => {
    const cEmail = normEmail(c.email)
    const cPhone = normPhone(c.phone)
    const cName = normName(c.firstName ?? null, c.lastName ?? null)
    return (email && cEmail === email) || (phone && cPhone === phone) || (name && cName === name)
  })

  if (!exists) {
    list.push({
      email,
      phone,
      firstName: appt.firstName ?? null,
      lastName: appt.lastName ?? null,
    })
  }
}

export async function GET(request: Request) {
  const { user, supabase } = await getAuthenticatedUser(request)

  if (!user || !supabase) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const requestedYear = searchParams.get('year')
    ? parseInt(searchParams.get('year') as string, 10)
    : null

  if (!requestedYear) {
    return NextResponse.json({ error: 'Year parameter required' }, { status: 400 })
  }

  console.log(`\n=== STARTING YEAR SYNC: ${requestedYear} for user ${user.id} ===`)

  // Fetch token
  const { data: tokenRow } = await supabase
    .from('acuity_tokens')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!tokenRow) return NextResponse.json({ error: 'No Acuity connection found' }, { status: 400 })

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
        return NextResponse.json({ error: 'Token refresh failed' }, { status: 500 })
      }
    } catch (err) {
      return NextResponse.json({ error: 'Failed to refresh token' }, { status: 500 })
    }
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('calendar')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'No profile found' }, { status: 400 })
  }

  // Get calendar
  let allCalendars: any[] = []
  try {
    const calRes = await fetch('https://acuityscheduling.com/api/v1/calendars', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!calRes.ok) throw new Error(`Calendars fetch failed`)
    allCalendars = await calRes.json()
  } catch (err) {
    console.error('Failed to fetch calendars:', err)
    return NextResponse.json({ error: 'Failed to fetch calendars' }, { status: 500 })
  }

  const barberCalendarName = (profile.calendar || '').trim().toLowerCase()
  const calendarMatch = allCalendars.find(
    (c) => c.name?.trim?.().toLowerCase?.() === barberCalendarName
  )
  
  if (!calendarMatch) {
    return NextResponse.json({ error: 'No matching calendar found' }, { status: 400 })
  }
  
  const calendarID = calendarMatch.id

  // Fetch appointments for entire year
  async function fetchAppointmentsForDay(dayStr: string) {
    const pageSize = 100
    let offset = 0
    const out: any[] = []

    while (true) {
      const dayUrl = new URL('https://acuityscheduling.com/api/v1/appointments')
      dayUrl.searchParams.set('minDate', dayStr)
      dayUrl.searchParams.set('maxDate', dayStr)
      dayUrl.searchParams.set('max', String(pageSize))
      dayUrl.searchParams.set('offset', String(offset))
      dayUrl.searchParams.set('calendarID', String(calendarID))

      const dayRes = await fetch(dayUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const dayData = await dayRes.json().catch(() => null)

      if (!dayRes.ok) {
        console.error('Acuity day fetch failed', dayStr, dayRes.status)
        break
      }

      if (!Array.isArray(dayData) || dayData.length === 0) break
      out.push(...dayData)
      if (dayData.length < pageSize) break
      offset += pageSize
    }

    return out
  }

  console.log(`Fetching appointments for year ${requestedYear}...`)
  
  const yearStart = new Date(requestedYear, 0, 1)
  const yearEnd = new Date(requestedYear, 11, 31)
  const today = new Date()
  const fetchEnd = yearEnd > today ? today : yearEnd

  let allYearAppointments: any[] = []
  
  for (let d = new Date(yearStart); d <= fetchEnd; d.setDate(d.getDate() + 1)) {
    const dayStr = d.toISOString().split('T')[0]
    const dayRows = await fetchAppointmentsForDay(dayStr)
    if (dayRows.length) allYearAppointments.push(...dayRows)
  }

  const now = new Date()
  const appointments = allYearAppointments.filter((a) => new Date(a.datetime) <= now)

  console.log(`Total appointments fetched for ${requestedYear}: ${appointments.length}`)

  // Pre-load ALL existing clients into cache
  const { data: existingClients } = await supabase
    .from('acuity_clients')
    .select('client_id, email, phone_normalized, first_name, last_name')
    .eq('user_id', user.id)

  const clientCache = new Map<string, string>()

  if (existingClients) {
    for (const client of existingClients) {
      if (client.phone_normalized) clientCache.set(`phone:${client.phone_normalized}`, client.client_id)
      if (client.email) clientCache.set(`email:${client.email}`, client.client_id)
      const nameKey = client.first_name && client.last_name
        ? `name:${client.first_name.toLowerCase()} ${client.last_name.toLowerCase()}`.trim()
        : null
      if (nameKey) clientCache.set(nameKey, client.client_id)
    }
  }

  console.log(`Loaded ${clientCache.size} existing client identifiers into cache`)

  // Track data for batch upserts
  const clientDataMap = new Map<string, {
    client_id: string
    email: string | null
    phone_normalized: string | null
    first_name: string | null
    last_name: string | null
    first_appt: string
    last_appt: string
    first_source: string | null
  }>()

  const appointmentsToUpsert: any[] = []
  const processedApptIds = new Set<string>()

  // Process all appointments in SINGLE PASS
  console.log('Processing appointments...')
  
  for (const appt of appointments) {
    if (!appt.id) continue
    if (processedApptIds.has(appt.id)) continue
    processedApptIds.add(appt.id)

    const parsed = parseDateStringSafe(appt.datetime)
    const dayKey = parsed?.dayKey || appt.datetime?.split('T')[0]
    if (!dayKey) continue

    const price = parseFloat(appt.priceSold || '0')
    const tip = parseFloat(appt.tip || '0')
    const email = normEmail(appt.email)
    const phoneNormalized = normalizePhoneE164(appt.phone)
    const firstName = appt.firstName || null
    const lastName = appt.lastName || null
    const nameDisplay = firstName && lastName ? `${firstName} ${lastName}`.trim() : ''

    if (!nameDisplay && !email && !phoneNormalized) continue

    const referralSource = extractSourceFromForms(appt.forms)

    // Get client_id from cache or generate new UUID
    let clientKey: string | undefined
    
    if (phoneNormalized && clientCache.has(`phone:${phoneNormalized}`)) {
      clientKey = clientCache.get(`phone:${phoneNormalized}`)
    } else if (email && clientCache.has(`email:${email}`)) {
      clientKey = clientCache.get(`email:${email}`)
    } else if (nameDisplay) {
      const nameKey = `name:${nameDisplay.toLowerCase()}`
      if (clientCache.has(nameKey)) {
        clientKey = clientCache.get(nameKey)
      }
    }
    
    if (!clientKey) {
      clientKey = crypto.randomUUID()
      if (phoneNormalized) clientCache.set(`phone:${phoneNormalized}`, clientKey)
      if (email) clientCache.set(`email:${email}`, clientKey)
      if (nameDisplay) clientCache.set(`name:${nameDisplay.toLowerCase()}`, clientKey)
    }

    // Track client data
    if (!clientDataMap.has(clientKey)) {
      clientDataMap.set(clientKey, {
        client_id: clientKey,
        email,
        phone_normalized: phoneNormalized,
        first_name: firstName,
        last_name: lastName,
        first_appt: dayKey,
        last_appt: dayKey,
        first_source: referralSource,
      })
    } else {
      const existing = clientDataMap.get(clientKey)!
      if (email && !existing.email) existing.email = email
      if (phoneNormalized && !existing.phone_normalized) existing.phone_normalized = phoneNormalized
      if (firstName && !existing.first_name) existing.first_name = firstName
      if (lastName && !existing.last_name) existing.last_name = lastName
      if (dayKey < existing.first_appt) existing.first_appt = dayKey
      if (dayKey > existing.last_appt) existing.last_appt = dayKey
      if (referralSource && !existing.first_source) existing.first_source = referralSource
    }

    // Collect appointment
    appointmentsToUpsert.push({
      user_id: user.id,
      acuity_appointment_id: appt.id,
      client_id: clientKey,
      phone_normalized: phoneNormalized,
      appointment_date: dayKey,
      revenue: price,
      tip: tip,
      datetime: appt.datetime,
      created_at: new Date().toISOString(),
    })
  }

  console.log(`Unique clients found: ${clientDataMap.size}`)
  console.log(`Appointments to upsert: ${appointmentsToUpsert.length}`)

  // Batch upsert appointments
  if (appointmentsToUpsert.length > 0) {
    console.log('Upserting appointments...')
    await supabase
      .from('acuity_appointments')
      .upsert(appointmentsToUpsert, { onConflict: 'user_id,acuity_appointment_id' })
  }

  // Calculate totals from acuity_appointments
  console.log('Calculating client totals...')
  const { data: clientAggregates } = await supabase
    .from('acuity_appointments')
    .select('client_id, appointment_date, revenue, tip')
    .eq('user_id', user.id)

  const clientTotals: Record<string, {
    total_appointments: number
    total_tips_all_time: number
    first_appt: string
    last_appt: string
  }> = {}

  if (clientAggregates) {
    for (const row of clientAggregates) {
      if (!clientTotals[row.client_id]) {
        clientTotals[row.client_id] = {
          total_appointments: 0,
          total_tips_all_time: 0,
          first_appt: row.appointment_date,
          last_appt: row.appointment_date,
        }
      }
      const totals = clientTotals[row.client_id]
      totals.total_appointments += 1
      totals.total_tips_all_time += row.tip || 0
      if (row.appointment_date < totals.first_appt) totals.first_appt = row.appointment_date
      if (row.appointment_date > totals.last_appt) totals.last_appt = row.appointment_date
    }
  }

  // Batch upsert clients
  console.log('Upserting clients...')
  const clientUpserts = Array.from(clientDataMap.values()).map(client => ({
    user_id: user.id,
    client_id: client.client_id,
    email: client.email,
    phone_normalized: client.phone_normalized,
    phone: client.phone_normalized,
    first_name: client.first_name,
    last_name: client.last_name,
    first_appt: clientTotals[client.client_id]?.first_appt || client.first_appt,
    last_appt: clientTotals[client.client_id]?.last_appt || client.last_appt,
    total_appointments: clientTotals[client.client_id]?.total_appointments || 0,
    total_tips_all_time: Math.min(clientTotals[client.client_id]?.total_tips_all_time || 0, 999.99),
    updated_at: new Date().toISOString(),
  }))

  if (clientUpserts.length > 0) {
    await supabase
      .from('acuity_clients')
      .upsert(clientUpserts, { onConflict: 'client_id' })
  }

  console.log(`\n=== YEAR SYNC COMPLETE: ${requestedYear} ===`)
  console.log(`Total appointments: ${appointments.length}`)
  console.log(`Unique clients: ${clientDataMap.size}`)

  return NextResponse.json({
    success: true,
    year: requestedYear,
    totalAppointments: appointments.length,
    totalClients: clientDataMap.size,
  })
}