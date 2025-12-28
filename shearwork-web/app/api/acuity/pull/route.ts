// Key changes made to reduce debug noise:
// 1. Removed excessive funnel debug logging
// 2. Removed comprehensive debug output section
// 3. Removed forms debug that's inside the main loop (causing duplication)
// 4. Kept only: firstApptLookup stats and weekly/monthly aggregation logs

// Search for "REMOVED DEBUG" comments to see what was taken out

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
        return NextResponse.json(
          { error: 'Token refresh failed', details: newTokens },
          { status: 500 }
        )
      }
    } catch (err) {
      return NextResponse.json({ error: 'Failed to refresh token', details: String(err) })
    }
  }

  // Fetch the barber profile (to get their calendar)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('calendar')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    console.log(profileError)
    return NextResponse.json({ error: 'No profile found' }, { status: 400 })
  }

  // -------------------- Calendar Logic --------------------------------
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

  // -------------------- Fetch appointments --------------------
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

  // ============================================================
  // ✅ BUILD FIRST APPOINTMENT LOOKUP from acuity_clients table
  // ============================================================
  const { data: existingClients } = await supabase
    .from('acuity_clients')
    .select('email, phone, phone_normalized, first_name, last_name, first_appt')
    .eq('user_id', user.id)

  const firstApptLookup: Record<string, string> = {}
  
  console.log('=== FIRST APPT LOOKUP ===')
  console.log('Existing clients:', existingClients?.length || 0)
  
  if (existingClients) {
    for (const client of existingClients) {
      const email = (client.email || '').toLowerCase().trim()
      const phone = normPhoneUtil(client.phone_normalized || client.phone)
      const nameKey = `${client.first_name || ''} ${client.last_name || ''}`.trim().toLowerCase()
      
      if (email && client.first_appt) firstApptLookup[email] = client.first_appt
      if (phone && client.first_appt) firstApptLookup[phone] = client.first_appt
      if (nameKey && client.first_appt) firstApptLookup[nameKey] = client.first_appt
    }
  }
  
  console.log('First appt lookup entries:', Object.keys(firstApptLookup).length)

  // ============================================================
  // ✅ BUILD WEEK TIMEFRAMES for the requested month
  // ============================================================
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

  // ============================================================
  // ✅ COMPUTE WEEKLY & MONTHLY FUNNELS using the module
  // ============================================================
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

  // REMOVED DEBUG: Comprehensive marketing funnels verification section

  // ---------------- Single loop aggregation ----------------
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

  const identityResolver = makeClientIdentityResolver(user.id)

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

  let uniqueClients: any[] = []
  
  for (const appt of appointments) {
    addUniqueClient(uniqueClients, appt)

    const parsed = parseDateStringSafe(appt.datetime)
    const apptDate = parsed ? new Date(`${parsed.dayKey}T00:00:00`) : new Date(appt.datetime)
    if (!apptDate || isNaN(apptDate.getTime())) continue

    const year = requestedYear!
    const monthName = requestedMonth!
    const dayKey = parsed?.dayKey || apptDate.toISOString().split('T')[0]
    const price = parseFloat(appt.priceSold || '0')

    const email = normEmail(appt.email)
    const phone = normPhone(appt.phone)
    const nameDisplay =
      appt.firstName && appt.lastName ? `${appt.firstName} ${appt.lastName}`.trim() : ''
    const nameKey = normName(appt.firstName ?? null, appt.lastName ?? null)

    if (!nameDisplay && !email && !phone) continue

    const clientKey = buildClientKey({
      email: appt.email,
      phone: appt.phone,
      firstName: appt.firstName,
      lastName: appt.lastName,
      datetime: appt.datetime,
      forms: appt.forms,
    } as AcuityAppointment, user.id)

    const returning = await isReturningClient(
      supabase,
      user.id,
      email ?? undefined,
      phone ?? undefined,
      appt.firstName,
      appt.lastName
    )

    const referralSource = extractSourceFromForms(appt.forms)

    // ---------- per-client stats (acuity_clients') ----------
    if (!clientStats[clientKey]) {
      clientStats[clientKey] = {
        client_id: clientKey,
        first_name: appt.firstName ?? null,
        last_name: appt.lastName ?? null,
        email: email,
        phone: phone,
        first_appt: dayKey,
        last_appt: dayKey,
        total_appointments: 0,
        total_tips_all_time: 0,
        first_source: referralSource ?? null,
      }
    }

    const stats = clientStats[clientKey]
    stats.total_appointments += 1
    if (!stats.first_source && referralSource) stats.first_source = referralSource
    if (!stats.email && email) stats.email = email
    if (!stats.phone && phone) stats.phone = phone
    if (!stats.first_name && appt.firstName) stats.first_name = appt.firstName
    if (!stats.last_name && appt.lastName) stats.last_name = appt.lastName
    if (!stats.first_appt || dayKey < stats.first_appt) stats.first_appt = dayKey
    if (!stats.last_appt || dayKey > stats.last_appt) stats.last_appt = dayKey

    // 3️⃣ Weekly
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
          sampleFirstName: appt.firstName ?? null,
          sampleLastName: appt.lastName ?? null,
          sampleEmail: email,
          samplePhone: phone,
          sampleNotes: appt.notes ?? null,
        }
      }
      weeklyClientTotals[weekKey][clientKey].totalPaid += price
      weeklyClientTotals[weekKey][clientKey].visits += 1
      if (!weeklyClientTotals[weekKey][clientKey].sampleEmail && email) weeklyClientTotals[weekKey][clientKey].sampleEmail = email
      if (!weeklyClientTotals[weekKey][clientKey].samplePhone && phone) weeklyClientTotals[weekKey][clientKey].samplePhone = phone
      if (!weeklyClientTotals[weekKey][clientKey].sampleFirstName && appt.firstName) weeklyClientTotals[weekKey][clientKey].sampleFirstName = appt.firstName
      if (!weeklyClientTotals[weekKey][clientKey].sampleLastName && appt.lastName) weeklyClientTotals[weekKey][clientKey].sampleLastName = appt.lastName
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

    const sourceResolvedDaily = referralSource || stats.first_source || 'Unknown'
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

  // -----------------------------------------------
  // ---------------- Batch upserts ----------------

  // ✅ Marketing funnels (MONTHLY)
  const funnelUpserts = Object.entries(monthlyFunnelsComputed).flatMap(([timeframeId, sources]) => {
    return Object.entries(sources).map(([source, stats]) => ({
      user_id: user.id,
      source,
      new_clients: stats.new_clients,
      returning_clients: stats.returning_clients,
      retention: stats.new_clients > 0 ? (stats.returning_clients / stats.new_clients) * 100 : 0,
      avg_ticket: stats.total_visits > 0 ? stats.total_revenue / stats.total_visits : 0,
      report_month: requestedMonth,
      report_year: requestedYear,
    }))
  })
  
  if (funnelUpserts.length > 0) {
    const { error: monthlyFunnelError } = await supabase
      .from('marketing_funnels')
      .upsert(funnelUpserts, { onConflict: 'user_id,source,report_month,report_year' })
    
    if (monthlyFunnelError) {
      console.error('Monthly funnels upsert error:', monthlyFunnelError)
    }
  }

  // ✅ Weekly marketing funnels
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
        retention: stats.new_clients > 0 ? (stats.returning_clients / stats.new_clients) * 100 : 0,
        avg_ticket: stats.total_visits > 0 ? stats.total_revenue / stats.total_visits : 0,
        updated_at: new Date().toISOString(),
      })
    }
  }

  if (weeklyFunnelUpserts.length > 0) {
    await supabase
      .from('weekly_marketing_funnels_base')
      .upsert(weeklyFunnelUpserts, { onConflict: 'user_id,source,week_number,report_month,report_year' })
  }

  // Monthly
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

  // Daily
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

  // Weekly
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

  // ✅ Weekly Top Clients
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
      await supabase.from('weekly_top_clients').upsert(weeklyClientUpserts, {
        onConflict: 'user_id,week_number,month,year,client_key',
      })
    }
  }

  // Service bookings
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

  // Daily service bookings
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

  // Daily marketing funnels
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

  // acuity_clients merge
  if (Object.keys(clientStats).length > 0) {
    const clientIds = Object.keys(clientStats)

    const { data: existingRows } = await supabase
      .from('acuity_clients')
      .select('client_id, first_appt, last_appt, total_appointments, total_tips_all_time, email, phone, phone_normalized, first_name, last_name')
      .eq('user_id', user.id)
      .in('client_id', clientIds)

    if (existingRows) {
      for (const row of existingRows) {
        const stats = clientStats[row.client_id]
        if (!stats) continue

        const prevFirst = (row.first_appt as string | null) ?? null
        if (prevFirst && (!stats.first_appt || prevFirst < stats.first_appt)) stats.first_appt = prevFirst

        const prevLast = (row.last_appt as string | null) ?? null
        if (prevLast && (!stats.last_appt || prevLast > stats.last_appt)) stats.last_appt = prevLast

        const prevTotal = (row.total_appointments as number | null) ?? 0
        if (prevTotal > stats.total_appointments) stats.total_appointments = prevTotal

        const prevTips = (row.total_tips_all_time as number | null) ?? 0
        if (prevTips > stats.total_tips_all_time) stats.total_tips_all_time = prevTips

        if (!stats.email && row.email) stats.email = row.email
        if (!stats.phone && (row.phone_normalized || row.phone)) stats.phone = (row.phone_normalized || row.phone) as string
        if (!stats.first_name && row.first_name) stats.first_name = row.first_name
        if (!stats.last_name && row.last_name) stats.last_name = row.last_name
      }
    }

    const clientUpserts = Object.values(clientStats).map((s: any) => ({
      user_id: user.id,
      client_id: s.client_id,
      first_name: s.first_name,
      last_name: s.last_name,
      email: s.email,
      phone: s.phone,
      phone_normalized: s.phone,
      first_appt: s.first_appt,
      last_appt: s.last_appt,
      total_appointments: s.total_appointments,
      total_tips_all_time: Math.min(s.total_tips_all_time, 999.99),
      updated_at: new Date().toISOString(),
    }))

    await supabase
      .from('acuity_clients')
      .upsert(clientUpserts, { onConflict: 'user_id,client_id' })
  }

  // Weekday summary
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