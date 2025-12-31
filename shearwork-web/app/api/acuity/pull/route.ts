/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'
import crypto from 'crypto'
import {
  buildClientKey,
  extractSourceFromForms,
  canonicalizeSource,
  normalizePhone as normPhoneUtil,
  computeFunnelsFromAppointments,
  buildMonthlyTimeframes,
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

// WEEK HELPERS
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

// -------------------- Normalizers --------------------
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

function makeClientIdentityResolver(userId: string) {
  const identifierToCanonical = new Map<string, string>()

  const getCanonical = (email: string | null, phone: string | null, name: string | null) => {
    const ids: string[] = []
    if (email) ids.push(`email:${email}`)
    if (phone) ids.push(`phone:${phone}`)
    if (name) ids.push(`name:${name}`)

    for (const id of ids) {
      const existing = identifierToCanonical.get(id)
      if (existing) {
        for (const other of ids) identifierToCanonical.set(other, existing)
        return existing
      }
    }

    const canonical =
      (email ? `email:${email}` : null) ||
      (phone ? `phone:${phone}` : null) ||
      (name ? `name:${name}` : null) ||
      `unknown:${crypto.randomUUID()}`

    for (const id of ids) identifierToCanonical.set(id, canonical)
    return canonical
  }

  const canonicalToClientId = (canonical: string) => {
    return crypto.createHash('sha256').update(`${userId}|${canonical}`).digest('hex')
  }

  return { getCanonical, canonicalToClientId }
}

async function isReturningClient(
  supabase: any,
  userId: string,
  email?: string,
  phone?: string,
  firstName?: string,
  lastName?: string
) {
  if (!email && !phone && !(firstName && lastName)) return false

  const e = normEmail(email)
  const p = normPhone(phone)
  const n = normName(firstName ?? null, lastName ?? null)

  let data: any[] = []

  try {
    if (e) {
      const { data: emailData, error } = await supabase
        .from('acuity_clients')
        .select('total_appointments')
        .eq('user_id', userId)
        .eq('email', e)
        .limit(1)

      if (error) throw error
      if (emailData && emailData.length > 0) data = emailData
    }

    if (data.length === 0 && p) {
      const { data: phoneData, error } = await supabase
        .from('acuity_clients')
        .select('total_appointments')
        .eq('user_id', userId)
        .eq('phone_normalized', p)
        .limit(1)

      if (error) throw error
      if (phoneData && phoneData.length > 0) data = phoneData
    }

    if (data.length === 0 && n) {
      const [first, ...rest] = n.split(' ')
      const last = rest.join(' ')
      const { data: nameData, error } = await supabase
        .from('acuity_clients')
        .select('total_appointments')
        .eq('user_id', userId)
        .eq('first_name', first)
        .eq('last_name', last)
        .limit(1)

      if (error) throw error
      if (nameData && nameData.length > 0) data = nameData
    }

    if (!data || data.length === 0) return false
    return data.some((row: any) => (row.total_appointments ?? 0) > 1)
  } catch (err: any) {
    console.error('Error checking client visits:', err)
    return false
  }
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

async function findOrCreateClient(
  supabase: any,
  userId: string,
  email: string | null,
  phoneNormalized: string | null,
  firstName: string | null,
  lastName: string | null,
  firstAppt: string,
  lastAppt: string,
  firstSource: string | null
): Promise<string> {
  const nameKey = firstName && lastName 
    ? `${firstName.toLowerCase().trim()} ${lastName.toLowerCase().trim()}`.trim()
    : null

  const matchedClients: any[] = []
  
  if (phoneNormalized) {
    const { data } = await supabase
      .from('acuity_clients')
      .select('*')
      .eq('user_id', userId)
      .eq('phone_normalized', phoneNormalized)
      .limit(1)
    if (data && data.length > 0) matchedClients.push(...data)
  }
  
  if (email && matchedClients.length === 0) {
    const { data } = await supabase
      .from('acuity_clients')
      .select('*')
      .eq('user_id', userId)
      .eq('email', email)
      .limit(1)
    if (data && data.length > 0) matchedClients.push(...data)
  }
  
  if (nameKey && matchedClients.length === 0 && firstName && lastName) {
    const { data } = await supabase
      .from('acuity_clients')
      .select('*')
      .eq('user_id', userId)
      .eq('first_name', firstName)
      .eq('last_name', lastName)
      .limit(1)
    if (data && data.length > 0) matchedClients.push(...data)
  }

  if (matchedClients.length > 1) {
    const uniqueMatches = Array.from(
      new Map(matchedClients.map(c => [c.client_id, c])).values()
    )
    
    if (uniqueMatches.length > 1) {
      const primary = uniqueMatches[0]
      const toMerge = uniqueMatches.slice(1)
      
      for (const client of toMerge) {
        await supabase
          .from('acuity_appointments')
          .update({ client_id: primary.client_id })
          .eq('user_id', userId)
          .eq('client_id', client.client_id)
        
        await supabase
          .from('acuity_clients')
          .delete()
          .eq('client_id', client.client_id)
      }
      
      // Recalculate date range after merging
      const { data: allAppts } = await supabase
        .from('acuity_appointments')
        .select('appointment_date')
        .eq('user_id', userId)
        .eq('client_id', primary.client_id)
        .order('appointment_date', { ascending: true })
      
      if (allAppts && allAppts.length > 0) {
        const newFirstAppt = allAppts[0].appointment_date
        const newLastAppt = allAppts[allAppts.length - 1].appointment_date
        
        await supabase
          .from('acuity_clients')
          .update({
            first_appt: newFirstAppt,
            last_appt: newLastAppt,
            updated_at: new Date().toISOString()
          })
          .eq('client_id', primary.client_id)
      }
      
      matchedClients.splice(0, matchedClients.length, primary)
    }
  }

  if (matchedClients.length > 0) {
    const existing = matchedClients[0]
    await supabase
      .from('acuity_clients')
      .update({
        email: email || existing.email,
        phone_normalized: phoneNormalized || existing.phone_normalized,
        phone: phoneNormalized || existing.phone,
        first_name: firstName || existing.first_name,
        last_name: lastName || existing.last_name,
        first_appt: existing.first_appt && existing.first_appt < firstAppt 
          ? existing.first_appt 
          : firstAppt,
        last_appt: existing.last_appt && existing.last_appt > lastAppt
          ? existing.last_appt
          : lastAppt,
        first_source: existing.first_source || firstSource,
        updated_at: new Date().toISOString(),
      })
      .eq('client_id', existing.client_id)
    
    return existing.client_id
  }

  const { data: newClient, error } = await supabase
    .from('acuity_clients')
    .insert({
      user_id: userId,
      email,
      phone_normalized: phoneNormalized,
      phone: phoneNormalized,
      first_name: firstName,
      last_name: lastName,
      first_appt: firstAppt,
      last_appt: lastAppt,
      first_source: firstSource,
      total_appointments: 0,
      total_tips_all_time: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('client_id')
    .single()

  if (error) {
    console.error('Error creating client:', error)
    throw error
  }

  return newClient.client_id
}

export async function GET(request: Request) {
  const { user, supabase } = await getAuthenticatedUser(request)

  if (!user || !supabase) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const requestedMonth = searchParams.get('month') || null
  const requestedYear = searchParams.get('year')
    ? parseInt(searchParams.get('year') as string, 10)
    : null

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
        return NextResponse.json(
          { error: 'Token refresh failed', details: newTokens },
          { status: 500 }
        )
      }
    } catch (err) {
      return NextResponse.json({ error: 'Failed to refresh token', details: String(err) })
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('calendar')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'No profile found' }, { status: 400 })
  }

  let allCalendars: any[] = []
  try {
    const calRes = await fetch('https://acuityscheduling.com/api/v1/calendars', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!calRes.ok) throw new Error(`Calendars fetch failed: ${calRes.status}`)
    allCalendars = await calRes.json()
  } catch (err) {
    console.error('Failed to fetch calendars:', err)
  }

  const barberCalendarName = (profile.calendar || '').trim().toLowerCase()
  const calendarMatch = allCalendars.find(
    (c) => c.name?.trim?.().toLowerCase?.() === barberCalendarName
  )
  if (!calendarMatch) {
    return NextResponse.json(
      { error: `No matching calendar found for barber: ${barberCalendarName}` },
      { status: 400 }
    )
  }
  const calendarID = calendarMatch.id

  let allData: any[] = []

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
        console.error('Acuity day fetch failed', dayStr, dayRes.status, dayData)
        break
      }

      if (!Array.isArray(dayData) || dayData.length === 0) break

      out.push(...dayData)

      if (dayData.length < pageSize) break
      offset += pageSize
    }

    return out
  }

  if (requestedMonth && requestedYear) {
    const start = new Date(`${requestedMonth} 1, ${requestedYear}`)
    const end = new Date(start)
    end.setMonth(end.getMonth() + 1)
    end.setDate(7)

    const today = new Date()
    if (end > today) {
      end.setFullYear(today.getFullYear(), today.getMonth(), today.getDate())
    }

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayStr = d.toISOString().split('T')[0]
      const dayRows = await fetchAppointmentsForDay(dayStr)
      if (dayRows.length) allData.push(...dayRows)
    }
  }

  const now = new Date()
  const appointments = allData.filter((a) => new Date(a.datetime) <= now)

  const { data: firstAppts } = await supabase
    .from('acuity_appointments')
    .select(`
      client_id,
      appointment_date,
      acuity_clients!inner(email, phone_normalized, first_name, last_name)
    `)
    .eq('user_id', user.id)
    .order('appointment_date', { ascending: true })

  const firstApptLookup: Record<string, string> = {}

  if (firstAppts) {
    const clientFirstAppts: Record<string, string> = {}
    for (const row of firstAppts) {
      if (!clientFirstAppts[row.client_id] || row.appointment_date < clientFirstAppts[row.client_id]) {
        clientFirstAppts[row.client_id] = row.appointment_date
      }
    }
    
    for (const row of firstAppts) {
      const client = Array.isArray(row.acuity_clients) ? row.acuity_clients[0] : row.acuity_clients
      if (!client) continue
      
      const firstDate = clientFirstAppts[row.client_id]
      
      if (client.email) firstApptLookup[client.email] = firstDate
      if (client.phone_normalized) firstApptLookup[client.phone_normalized] = firstDate
      const nameKey = `${client.first_name || ''} ${client.last_name || ''}`.trim().toLowerCase()
      if (nameKey) firstApptLookup[nameKey] = firstDate
    }
  }

  const requestedMonthIndex = MONTHS.indexOf(requestedMonth!)
  const requestedMonthStart = new Date(requestedYear!, requestedMonthIndex, 1)
  const requestedMonthEnd = new Date(requestedYear!, requestedMonthIndex + 1, 0)

  const weekTimeframes: TimeframeDef[] = []
  const weekMetaMap: Record<string, any> = {}
  
  for (let d = new Date(requestedMonthStart); d <= requestedMonthEnd; d.setDate(d.getDate() + 1)) {
    const weekMeta = getWeekMetaForDate(d)
    const weekStart = new Date(weekMeta.weekStartISO)
    
    const weekStartDay = Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate())
    const monthStartDay = Date.UTC(requestedMonthStart.getUTCFullYear(), requestedMonthStart.getUTCMonth(), requestedMonthStart.getUTCDate())
    const monthEndDay = Date.UTC(requestedMonthEnd.getUTCFullYear(), requestedMonthEnd.getUTCMonth(), requestedMonthEnd.getUTCDate())
    
    if (weekStartDay >= monthStartDay && weekStartDay <= monthEndDay) {
      const weekKey = `week-${weekMeta.weekNumber}`
      
      if (!weekMetaMap[weekKey]) {
        weekMetaMap[weekKey] = weekMeta
        weekTimeframes.push({
          id: weekKey,
          startISO: weekMeta.weekStartISO,
          endISO: weekMeta.weekEndISO,
        })
      }
    }
  }

  const weeklyFunnelsComputed = computeFunnelsFromAppointments(
    appointments as AcuityAppointment[],
    user.id,
    firstApptLookup,
    weekTimeframes,
  )

  const monthlyTimeframes: TimeframeDef[] = [{
    id: requestedMonth!,
    startISO: requestedMonthStart.toISOString().split('T')[0],
    endISO: requestedMonthEnd.toISOString().split('T')[0],
  }]

  const monthlyFunnelsComputed = computeFunnelsFromAppointments(
    appointments as AcuityAppointment[],
    user.id,
    firstApptLookup,
    monthlyTimeframes,
  )

  const monthlyAgg: Record<string, { revenue: number; count: number }> = {}
  const dailyAgg: Record<string, { revenue: number; count: number }> = {}
  const weeklyAgg: Record<
    string,
    {
      meta: any
      revenue: number
      tips: number
      expenses: number
      numAppointments: number
      clientVisitMap: Record<string, number>
    }
  > = {}
  const serviceCounts: Record<string, { month: string; year: number; count: number; price: number }> = {}
  const dailyServiceCounts: Record<string, { date: string; count: number; price: number }> = {}
  const funnelMapDaily: Record<
    string,
    Record<string, { totalVisits: number; totalRevenue: number; clientIds: Set<string> }>
  > = {}
  const monthlyClientMap: Record<string, Record<string, number>> = {}
  const monthlyWeekdayAgg: Record<string, number> = {}

  const clientStats: Record<
    string,
    {
      client_id: string
      first_name: string | null
      last_name: string | null
      email: string | null
      phone: string | null
      first_appt: string | null
      last_appt: string | null
      total_appointments: number
      total_tips_all_time: number
      first_source?: string | null
    }
  > = {}

  const weeklyClientTotals: Record<
    string,
    Record<
      string,
      { totalPaid: number; visits: number; sampleFirstName?: string | null; sampleLastName?: string | null; sampleEmail?: string | null; samplePhone?: string | null; sampleNotes?: string | null }
    >
  > = {}

  const monthIndex = MONTHS.indexOf(requestedMonth!)
  const startOfMonth = new Date(requestedYear!, monthIndex, 1)
  const endOfMonth = new Date(requestedYear!, monthIndex + 1, 0)

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

  // Fetch existing appointments for phone cache
  const { data: existingAppointments } = await supabase
    .from('acuity_appointments')
    .select('acuity_appointment_id, client_id, phone_normalized')
    .eq('user_id', user.id)

  if (existingAppointments) {
    for (const appt of existingAppointments) {
      if (appt.phone_normalized) {
        const phoneKey = `phone:${appt.phone_normalized}`
        if (!clientCache.has(phoneKey)) {
          clientCache.set(phoneKey, appt.client_id)
        }
      }
    }
  }

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
  let uniqueClients: any[] = []

  for (const appt of appointments) {
    if (!appt.id) continue
    if (processedApptIds.has(appt.id)) continue
    processedApptIds.add(appt.id)
    
    addUniqueClient(uniqueClients, appt)

    const parsed = parseDateStringSafe(appt.datetime)
    const apptDate = parsed ? new Date(`${parsed.dayKey}T00:00:00`) : new Date(appt.datetime)
    if (!apptDate || isNaN(apptDate.getTime())) continue

    const year = requestedYear!
    const monthName = requestedMonth!
    const dayKey = parsed?.dayKey || apptDate.toISOString().split('T')[0]
    const price = parseFloat(appt.priceSold || '0')
    const tip = parseFloat(appt.tip || '0')

    const email = normEmail(appt.email)
    const phoneNormalized = normalizePhoneE164(appt.phone)
    const firstName = appt.firstName || null
    const lastName = appt.lastName || null
    const nameDisplay = firstName && lastName ? `${firstName} ${lastName}`.trim() : ''

    if (!nameDisplay && !email && !phoneNormalized) continue

    const referralSource = extractSourceFromForms(appt.forms)

    let clientKey: string | undefined

    if (phoneNormalized && clientCache.has(`phone:${phoneNormalized}`)) {
      clientKey = clientCache.get(`phone:${phoneNormalized}`)
    }

    if (!clientKey && email && clientCache.has(`email:${email}`)) {
      clientKey = clientCache.get(`email:${email}`)
    }

    if (!clientKey && nameDisplay) {
      const nameKey = `name:${nameDisplay.toLowerCase()}`
      if (clientCache.has(nameKey)) {
        clientKey = clientCache.get(nameKey)
      }
    }

    if (!clientKey) {
      clientKey = crypto.randomUUID()
      
      if (phoneNormalized) {
        clientCache.set(`phone:${phoneNormalized}`, clientKey)
      }
      if (email) {
        clientCache.set(`email:${email}`, clientKey)
      }
      if (nameDisplay) {
        clientCache.set(`name:${nameDisplay.toLowerCase()}`, clientKey)
      }
    } else {
      if (phoneNormalized && !clientCache.has(`phone:${phoneNormalized}`)) {
        clientCache.set(`phone:${phoneNormalized}`, clientKey)
      }
      if (email && !clientCache.has(`email:${email}`)) {
        clientCache.set(`email:${email}`, clientKey)
      }
      if (nameDisplay && !clientCache.has(`name:${nameDisplay.toLowerCase()}`)) {
        clientCache.set(`name:${nameDisplay.toLowerCase()}`, clientKey)
      }
    }

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

    // Don't include revenue in upsert - we'll set it only for NEW appointments
    // This preserves any manual edits to revenue
    appointmentsToUpsert.push({
      user_id: user.id,
      acuity_appointment_id: appt.id,
      client_id: clientKey,
      phone_normalized: phoneNormalized,
      appointment_date: dayKey,
      datetime: appt.datetime,
      service_type: appt.type || null,
      created_at: new Date().toISOString(),
      _acuity_tip: tip,
      _acuity_revenue: price,
    })

    const weekMeta = getWeekMetaForDate(apptDate)
    const weekKey = `${requestedYear}||${requestedMonth}||${String(weekMeta.weekNumber).padStart(2, '0')}||${weekMeta.weekStartISO}`

    if (!weeklyAgg[weekKey]) {
      weeklyAgg[weekKey] = {
        meta: weekMeta,
        revenue: 0,
        tips: 0,
        expenses: 0,
        numAppointments: 0,
        clientVisitMap: {},
      }
    }

    const wEntry = weeklyAgg[weekKey]
    wEntry.revenue += price
    wEntry.numAppointments++

    if (!wEntry.clientVisitMap[clientKey]) wEntry.clientVisitMap[clientKey] = 0
    wEntry.clientVisitMap[clientKey]++

    const weekStart = new Date(weekMeta.weekStartISO)
    const weekStartDay = Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate())
    const monthStartDay = Date.UTC(requestedMonthStart.getUTCFullYear(), requestedMonthStart.getUTCMonth(), requestedMonthStart.getUTCDate())
    const monthEndDay = Date.UTC(requestedMonthEnd.getUTCFullYear(), requestedMonthEnd.getUTCMonth(), requestedMonthEnd.getUTCDate())
    
    const weekBelongsToRequestedMonth = weekStartDay >= monthStartDay && weekStartDay <= monthEndDay

    if (weekBelongsToRequestedMonth) {
      if (!weeklyClientTotals[weekKey]) weeklyClientTotals[weekKey] = {}
      if (!weeklyClientTotals[weekKey][clientKey]) {
        weeklyClientTotals[weekKey][clientKey] = {
          totalPaid: 0,
          visits: 0,
          sampleFirstName: firstName,
          sampleLastName: lastName,
          sampleEmail: email,
          samplePhone: phoneNormalized,
          sampleNotes: appt.notes ?? null,
        }
      }
      weeklyClientTotals[weekKey][clientKey].totalPaid += price
      weeklyClientTotals[weekKey][clientKey].visits += 1
      if (!weeklyClientTotals[weekKey][clientKey].sampleEmail && email) weeklyClientTotals[weekKey][clientKey].sampleEmail = email
      if (!weeklyClientTotals[weekKey][clientKey].samplePhone && phoneNormalized) weeklyClientTotals[weekKey][clientKey].samplePhone = phoneNormalized
      if (!weeklyClientTotals[weekKey][clientKey].sampleFirstName && firstName) weeklyClientTotals[weekKey][clientKey].sampleFirstName = firstName
      if (!weeklyClientTotals[weekKey][clientKey].sampleLastName && lastName) weeklyClientTotals[weekKey][clientKey].sampleLastName = lastName
    }

    if (apptDate.getMonth() !== requestedMonthIndex) continue

    const weekdayKey = parsed ? getWeekdayName(apptDate) : getWeekdayName(new Date(appt.datetime))
    const monthWeekdayKey = `${user.id}||${requestedYear}||${requestedMonth}||${weekdayKey}`
    if (!monthlyWeekdayAgg[monthWeekdayKey]) monthlyWeekdayAgg[monthWeekdayKey] = 0
    monthlyWeekdayAgg[monthWeekdayKey]++

    const monthKey = `${year}||${monthName}`
    if (!monthlyAgg[monthKey]) monthlyAgg[monthKey] = { revenue: 0, count: 0 }
    monthlyAgg[monthKey].revenue += price
    monthlyAgg[monthKey].count++

    if (!dailyAgg[dayKey]) dailyAgg[dayKey] = { revenue: 0, count: 0 }
    dailyAgg[dayKey].revenue += price
    dailyAgg[dayKey].count++

    if (!monthlyClientMap[monthKey]) monthlyClientMap[monthKey] = {}
    if (!monthlyClientMap[monthKey][clientKey]) monthlyClientMap[monthKey][clientKey] = 0
    monthlyClientMap[monthKey][clientKey]++

    const sourceResolvedDaily = referralSource || 'Unknown'
    if (!funnelMapDaily[dayKey]) funnelMapDaily[dayKey] = {}
    if (!funnelMapDaily[dayKey][sourceResolvedDaily]) {
      funnelMapDaily[dayKey][sourceResolvedDaily] = {
        totalVisits: 0,
        totalRevenue: 0,
        clientIds: new Set(),
      }
    }
    const df = funnelMapDaily[dayKey][sourceResolvedDaily]
    df.totalVisits += 1
    df.totalRevenue += price
    df.clientIds.add(clientKey)

    let cleanApptType = `${appt.type}`
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\b\w/g, (c: string) => c.toUpperCase())

    const svcKey = `${cleanApptType || 'Unknown'}||${monthName}||${year}`
    if (!serviceCounts[svcKey]) {
      serviceCounts[svcKey] = { month: monthName, year, count: 0, price: appt.price }
    }
    serviceCounts[svcKey].count++

    const dailySvcKey = `${cleanApptType || 'Unknown'}||${dayKey}`
    if (!dailyServiceCounts[dailySvcKey]) {
      dailyServiceCounts[dailySvcKey] = { date: dayKey, count: 0, price: appt.price }
    }
    dailyServiceCounts[dailySvcKey].count++
  }
  
  if (appointmentsToUpsert.length > 0) {
<<<<<<< HEAD
  const acuityTips: Record<string, number> = {}
  const cleanedAppointments = appointmentsToUpsert.map(appt => {
    const { _acuity_tip, ...rest } = appt
    acuityTips[appt.acuity_appointment_id] = _acuity_tip || 0
    return rest
  })
  
  const { data: upsertedAppts, error } = await supabase
    .from('acuity_appointments')
    .upsert(cleanedAppointments, { onConflict: 'user_id,acuity_appointment_id' })
    .select('id, acuity_appointment_id, tip')
    .limit(100000)
  
  if (error) {
    console.error('!!! APPOINTMENT UPSERT ERROR !!!:', error)
  } else if (upsertedAppts && upsertedAppts.length > 0) {
    const newApptsNeedingTips = upsertedAppts.filter(appt => appt.tip === null)
    
    if (newApptsNeedingTips.length > 0) {
      for (const appt of newApptsNeedingTips) {
        const acuityTip = acuityTips[appt.acuity_appointment_id] || 0
        await supabase
          .from('acuity_appointments')
          .update({ tip: acuityTip })
          .eq('id', appt.id)
=======
    const acuityTips: Record<string, number> = {}
    const acuityRevenue: Record<string, number> = {}
    
    const cleanedAppointments = appointmentsToUpsert.map(appt => {
      const { _acuity_tip, _acuity_revenue, ...rest } = appt
      acuityTips[appt.acuity_appointment_id] = _acuity_tip || 0
      acuityRevenue[appt.acuity_appointment_id] = _acuity_revenue || 0
      return rest
    })
    
    console.log('Upserting appointments count:', cleanedAppointments.length)
    
    const { data: upsertedAppts, error } = await supabase
      .from('acuity_appointments')
      .upsert(cleanedAppointments, { onConflict: 'user_id,acuity_appointment_id' })
      .select('id, acuity_appointment_id, tip, revenue')
    
    if (error) {
      console.error('Appointment upsert error:', error)
    } else if (upsertedAppts && upsertedAppts.length > 0) {
      // Only set revenue and tip for NEW appointments (where they are null)
      // This preserves any manual edits to existing appointments
      const newApptsNeedingValues = upsertedAppts.filter(appt => 
        appt.revenue === null || appt.tip === null
      )
      
      if (newApptsNeedingValues.length > 0) {
        console.log('Setting revenue/tip for new appointments:', newApptsNeedingValues.length)
        for (const appt of newApptsNeedingValues) {
          const updates: { tip?: number; revenue?: number } = {}
          
          if (appt.tip === null) {
            updates.tip = acuityTips[appt.acuity_appointment_id] || 0
          }
          if (appt.revenue === null) {
            updates.revenue = acuityRevenue[appt.acuity_appointment_id] || 0
          }
          
          if (Object.keys(updates).length > 0) {
            await supabase
              .from('acuity_appointments')
              .update(updates)
              .eq('id', appt.id)
          }
>>>>>>> 9d6f1ba1905160b2c78e5083f8223391fbe9fe3d
        }
      }
    }
  }

  const { data: clientTotalsData } = await supabase
    .rpc('calculate_client_appointment_stats', { p_user_id: user.id })

  const clientTotals: Record<string, {
    total_appointments: number
    total_tips_all_time: number
    first_appt: string
    last_appt: string
  }> = {}

  if (clientTotalsData) {
    for (const row of clientTotalsData) {
      clientTotals[row.client_id] = {
        total_appointments: row.total_appointments,
        total_tips_all_time: row.total_tips_all_time,
        first_appt: row.first_appt,
        last_appt: row.last_appt,
      }
    }
  }

  const clientUpserts = await Promise.all(
    Array.from(clientDataMap.values()).map(async (client) => {
      let totals = clientTotals[client.client_id]
      
      // If totals missing, fetch them
      if (!totals) {
        const { data: appts } = await supabase
          .from('acuity_appointments')
          .select('appointment_date, tip')
          .eq('user_id', user.id)
          .eq('client_id', client.client_id)
          .order('appointment_date', { ascending: true })
        
        if (appts && appts.length > 0) {
          totals = {
            total_appointments: appts.length,
            total_tips_all_time: appts.reduce((sum, a) => sum + (a.tip || 0), 0),
            first_appt: appts[0].appointment_date,
            last_appt: appts[appts.length - 1].appointment_date,
          }
        } else {
          // New client - use clientDataMap values
          totals = {
            total_appointments: 0,
            total_tips_all_time: 0,
            first_appt: client.first_appt,
            last_appt: client.last_appt,
          }
        }
      }
      
      return {
        user_id: user.id,
        client_id: client.client_id,
        email: client.email,
        phone_normalized: client.phone_normalized,
        phone: client.phone_normalized,
        first_name: client.first_name,
        last_name: client.last_name,
        first_appt: totals.first_appt,
        last_appt: totals.last_appt,
        total_appointments: totals.total_appointments,
        total_tips_all_time: Math.min(totals.total_tips_all_time, 999.99),
        updated_at: new Date().toISOString(),
      }
    })
  )

  // Also update any existing clients that weren't in this sync but have updated totals
  // This ensures last_appt and total_appointments stay accurate
  const existingClientIds = new Set(clientUpserts.map(c => c.client_id))
  
  for (const [clientId, totals] of Object.entries(clientTotals)) {
    if (!existingClientIds.has(clientId)) {
      // This client exists in appointments but wasn't in this sync batch
      // Update their totals directly
      await supabase
        .from('acuity_clients')
        .update({
          first_appt: totals.first_appt,
          last_appt: totals.last_appt,
          total_appointments: totals.total_appointments,
          total_tips_all_time: Math.min(totals.total_tips_all_time || 0, 999.99),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('client_id', clientId)
    }
  }

  if (clientUpserts.length > 0) {
    await supabase
      .from('acuity_clients')
      .upsert(clientUpserts, { onConflict: 'user_id,client_id' })
  }

  const funnelUpserts = Object.entries(monthlyFunnelsComputed).flatMap(([timeframeId, sources]) => {
    return Object.entries(sources).map(([source, stats]) => ({
      user_id: user.id,
      source,
      new_clients: stats.new_clients,
      returning_clients: stats.returning_clients,
      new_clients_retained: stats.new_clients_retained,
      retention: stats.new_clients > 0 ? (stats.new_clients_retained / stats.new_clients) * 100 : 0,
      avg_ticket: stats.total_visits > 0 ? stats.total_revenue / stats.total_visits : 0,
      report_month: requestedMonth,
      report_year: requestedYear,
    }))
  })
  
  if (funnelUpserts.length > 0) {
    await supabase
      .from('marketing_funnels')
      .upsert(funnelUpserts, { onConflict: 'user_id,source,report_month,report_year' })
  }

  const weeklyFunnelUpserts: any[] = []
  
  for (const [timeframeId, sources] of Object.entries(weeklyFunnelsComputed)) {
    const weekKey = timeframeId
    const weekNumber = parseInt(weekKey.split('-')[1])
    const meta = weekMetaMap[weekKey]
    
    if (!meta) continue
    
    for (const [source, stats] of Object.entries(sources)) {
      weeklyFunnelUpserts.push({
        user_id: user.id,
        source,
        week_number: weekNumber,
        report_month: requestedMonth,
        report_year: requestedYear,
        new_clients: stats.new_clients,
        returning_clients: stats.returning_clients,
        new_clients_retained: stats.new_clients_retained,
        retention: stats.new_clients > 0 ? (stats.new_clients_retained / stats.new_clients) * 100 : 0,
        avg_ticket: stats.total_visits > 0 ? stats.total_revenue / stats.total_visits : 0,
        updated_at: new Date().toISOString(),
      })
    }
  }

  if (weeklyFunnelUpserts.length > 0) {
    const { error: weeklyFunnelError } = await supabase
      .from('weekly_marketing_funnels_base')
      .upsert(weeklyFunnelUpserts, { onConflict: 'user_id,source,week_number,report_month,report_year' })
    
    if (weeklyFunnelError) throw weeklyFunnelError
  }

  const monthlyUpserts = await Promise.all(
    Object.entries(monthlyAgg).map(async ([key, val]) => {
      const [yearStr, month] = key.split('||')
      const monthKey = month
      const funnelDataForMonth = monthlyFunnelsComputed[monthKey] || {}
      
      let totalNewClients = 0
      let totalReturningClients = 0
      
      for (const [source, stats] of Object.entries(funnelDataForMonth)) {
        totalNewClients += (stats as FunnelStats).new_clients || 0
        totalReturningClients += (stats as FunnelStats).returning_clients || 0
      }

      return {
        user_id: user.id,
        month,
        year: parseInt(yearStr),
        total_revenue: val.revenue,
        num_appointments: val.count,
        new_clients: totalNewClients,
        returning_clients: totalReturningClients,
        unique_clients: uniqueClients.length,
        updated_at: new Date().toISOString(),
      }
    })
  )

  await supabase.from('monthly_data').upsert(monthlyUpserts, { onConflict: 'user_id,month,year' })

  for (const [day, val] of Object.entries(dailyAgg)) {
    const [y, m] = day.split('-').map(Number)
    const month = MONTHS[m - 1]
    const year = y
    const existing = await supabase
      .from('daily_data')
      .select('id')
      .eq('user_id', user.id)
      .eq('date', day)
      .maybeSingle()

    if (existing.data?.id) {
      await supabase
        .from('daily_data')
        .update({
          total_revenue: val.revenue,
          num_appointments: val.count,
          month,
          year,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.data.id)
    } else {
      await supabase.from('daily_data').insert([
        {
          user_id: user.id,
          date: day,
          total_revenue: val.revenue,
          num_appointments: val.count,
          month,
          year,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
    }
  }

  const weeklyUpserts = Object.values(weeklyAgg)
    .filter((w) => {
      const weekStart = new Date(w.meta.weekStartISO)
      const startOfMonth = new Date(`${requestedMonth} 1, ${requestedYear}`)
      const endOfMonth = new Date(startOfMonth)
      endOfMonth.setMonth(endOfMonth.getMonth() + 1)
      endOfMonth.setDate(0)

      const weekStartDay = Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate())
      const monthStartDay = Date.UTC(startOfMonth.getUTCFullYear(), startOfMonth.getUTCMonth(), startOfMonth.getUTCDate())
      const monthEndDay = Date.UTC(endOfMonth.getUTCFullYear(), endOfMonth.getUTCMonth(), endOfMonth.getUTCDate())

      return weekStartDay >= monthStartDay && weekStartDay <= monthEndDay
    })
    .map((w) => {
      const c = new Date().toISOString()
      const weekMonth = requestedMonth
      const weekYear = requestedYear

      const weekKey = `week-${w.meta.weekNumber}`
      const funnelDataForWeek = weeklyFunnelsComputed[weekKey] || {}
      
      let totalNewClients = 0
      let totalReturningClients = 0
      
      for (const [source, stats] of Object.entries(funnelDataForWeek)) {
        totalNewClients += (stats as FunnelStats).new_clients || 0
        totalReturningClients += (stats as FunnelStats).returning_clients || 0
      }

      return {
        user_id: user.id,
        week_number: w.meta.weekNumber,
        start_date: w.meta.weekStartISO,
        end_date: w.meta.weekEndISO,
        total_revenue: w.revenue,
        expenses: w.expenses,
        num_appointments: w.numAppointments,
        new_clients: totalNewClients,
        returning_clients: totalReturningClients,
        year: weekYear,
        month: weekMonth,
        created_at: c,
        updated_at: c,
      }
    })

  await supabase.from('weekly_data').upsert(weeklyUpserts, { onConflict: 'user_id,week_number,month,year' })

  for (const [weekKey, perClient] of Object.entries(weeklyClientTotals)) {
    const parts = weekKey.split('||')
    const weekYear = parseInt(parts[0])
    const weekMonth = parts[1]
    const weekNumber = parseInt(parts[2])
    const weekStartISO = parts[3]

    if (weekMonth !== requestedMonth) continue

    const meta = weeklyAgg[weekKey]?.meta
    const startISO = meta?.weekStartISO ?? weekStartISO
    const endISO = meta?.weekEndISO ?? (() => {
      const start = new Date(`${startISO}T00:00:00`)
      start.setDate(start.getDate() + 6)
      return toISODate(start)
    })()

    const c = new Date().toISOString()

    const weeklyClientUpserts = Object.entries(perClient).map(([clientKey, info]) => {
      const first = info.sampleFirstName ?? ''
      const last = info.sampleLastName ?? ''
      const display = `${first} ${last}`.trim()

      return {
        user_id: user.id,
        client_id: clientKey,
        client_key: clientKey,
        client_name: display || 'Unknown',
        total_paid: Math.round((info.totalPaid ?? 0) * 100) / 100,
        num_visits: info.visits ?? 0,
        email: info.sampleEmail ?? '',
        phone: info.samplePhone ?? '',
        week_number: weekNumber,
        start_date: startISO,
        end_date: endISO,
        month: requestedMonth,
        year: requestedYear,
        updated_at: c,
        created_at: c,
        notes: info.sampleNotes ?? null,
      }
    })

    if (weeklyClientUpserts.length > 0) {
      const { error } = await supabase
        .from('weekly_top_clients')
        .upsert(weeklyClientUpserts, {
          onConflict: 'user_id,week_number,month,year,client_key',
        })
      
      if (error) {
        console.error('Weekly top clients upsert error:', error)
      }
    }
  }

  const { data: monthlyAppointments } = await supabase
    .from('acuity_appointments')
    .select('client_id, revenue')
    .eq('user_id', user.id)
    .gte('appointment_date', requestedMonthStart.toISOString().split('T')[0])
    .lte('appointment_date', requestedMonthEnd.toISOString().split('T')[0])

  const clientIds = [...new Set(monthlyAppointments?.map(a => a.client_id) || [])]
  
  const { data: clientDetails } = await supabase
    .from('acuity_clients')
    .select('client_id, first_name, last_name, email, phone_normalized, phone')
    .eq('user_id', user.id)
    .in('client_id', clientIds)

  const clientLookup = new Map(
    clientDetails?.map(c => [c.client_id, c]) || []
  )

  const monthlyClientAgg: Record<string, {
    total_paid: number
    num_visits: number
    client_name: string
    email: string
    phone: string
    phone_normalized: string
  }> = {}

  if (monthlyAppointments) {
    for (const row of monthlyAppointments) {
      const client = clientLookup.get(row.client_id)
      if (!client) continue

      const clientId = row.client_id
      const firstName = client.first_name || ''
      const lastName = client.last_name || ''
      const clientName = `${firstName} ${lastName}`.trim() || 'Unknown'

      if (!monthlyClientAgg[clientId]) {
        monthlyClientAgg[clientId] = {
          total_paid: 0,
          num_visits: 0,
          client_name: clientName,
          email: client.email || '',
          phone: client.phone || '',
          phone_normalized: client.phone_normalized || '',
        }
      }

      monthlyClientAgg[clientId].total_paid += parseFloat(row.revenue || '0')
      monthlyClientAgg[clientId].num_visits += 1
    }
  }

  const reportTopClientsUpserts = Object.entries(monthlyClientAgg).map(([clientId, data]) => ({
    user_id: user.id,
    client_id: clientId,
    client_key: clientId,
    client_name: data.client_name,
    total_paid: Math.round(data.total_paid * 100) / 100,
    num_visits: data.num_visits,
    email: data.email,
    phone: data.phone_normalized || data.phone,
    month: requestedMonth,
    year: requestedYear,
    rank: null,
    report_id: null,
    notes: null,
    updated_at: new Date().toISOString(),
  }))

  if (reportTopClientsUpserts.length > 0) {
    const { error } = await supabase
      .from('report_top_clients')
      .upsert(reportTopClientsUpserts, { onConflict: 'user_id,month,year,client_key' })
    
    if (error) {
      console.error('Report top clients upsert error:', error)
    }
  }

  const serviceUpserts = Object.entries(serviceCounts).map(([key, val]) => {
    const [service, month, yearStr] = key.split('||')
    return {
      user_id: user.id,
      service_name: service,
      bookings: val.count,
      price: val.price,
      report_month: month,
      report_year: parseInt(yearStr),
      created_at: new Date().toISOString(),
    }
  })
  await supabase
    .from('service_bookings')
    .upsert(serviceUpserts, { onConflict: 'user_id,service_name,report_month,report_year' })

  const dailyServiceUpserts = Object.entries(dailyServiceCounts).map(([key, val]) => {
    const [service, date] = key.split('||')
    return {
      user_id: user.id,
      service_name: service,
      bookings: val.count,
      price: val.price,
      report_date: date,
      created_at: new Date().toISOString(),
    }
  })
  await supabase
    .from('daily_service_bookings')
    .upsert(dailyServiceUpserts, { onConflict: 'user_id,service_name,report_date' })

  const dailyFunnelUpserts = Object.entries(funnelMapDaily).flatMap(([dayKey, sources]) => {
    return Object.entries(sources).map(([source, stats]) => ({
      user_id: user.id,
      source,
      avg_ticket: stats.totalVisits > 0 ? stats.totalRevenue / stats.totalVisits : 0,
      total_revenue: Math.round(stats.totalRevenue * 100) / 100,
      count: stats.totalVisits,
      client_ids: Array.from(stats.clientIds),
      report_date: dayKey,
      created_at: new Date().toISOString(),
    }))
  })

  if (dailyFunnelUpserts.length > 0) {
    await supabase
      .from('daily_marketing_funnels')
      .upsert(dailyFunnelUpserts, { onConflict: 'user_id,source,report_date' })
  }

  const weekdayUpserts = Object.entries(monthlyWeekdayAgg).map(([key, total]) => {
    const [userId, yearStr, month, weekday] = key.split('||')
    return {
      user_id: userId,
      year: parseInt(yearStr),
      month,
      weekday,
      total_appointments: total,
      last_updated: new Date().toISOString(),
    }
  })

  await supabase
    .from('monthly_appointments_summary')
    .upsert(weekdayUpserts, { onConflict: 'user_id,year,month,weekday' })

  return NextResponse.json({
    endpoint: 'appointments',
    fetched_at: new Date().toISOString(),
    acuity_data: appointments,
  })
}