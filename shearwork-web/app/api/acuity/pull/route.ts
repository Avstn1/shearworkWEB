/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'
import crypto from 'crypto'

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

// ✅ NEW: Stable identity resolver (fixes duplicates)
function makeClientIdentityResolver(userId: string) {
  // any identifier (email/phone/name) -> canonical key
  const identifierToCanonical = new Map<string, string>()

  const getCanonical = (email: string | null, phone: string | null, name: string | null) => {
    const ids: string[] = []
    if (email) ids.push(`email:${email}`)
    if (phone) ids.push(`phone:${phone}`)
    if (name) ids.push(`name:${name}`)

    // If any identifier already mapped, reuse that canonical
    for (const id of ids) {
      const existing = identifierToCanonical.get(id)
      if (existing) {
        // also union: map the rest onto it
        for (const other of ids) identifierToCanonical.set(other, existing)
        return existing
      }
    }

    // Otherwise choose a canonical in priority order
    const canonical =
      (email ? `email:${email}` : null) ||
      (phone ? `phone:${phone}` : null) ||
      (name ? `name:${name}` : null) ||
      `unknown:${crypto.randomUUID()}`

    for (const id of ids) identifierToCanonical.set(id, canonical)
    return canonical
  }

  const canonicalToClientId = (canonical: string) => {
    // deterministic stable id per user + canonical
    return crypto.createHash('sha256').update(`${userId}|${canonical}`).digest('hex')
  }

  return { getCanonical, canonicalToClientId }
}

// -------------------- Returning client check (kept) --------------------
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

    // ✅ FIX: prefer phone_normalized for lookups (phone column might not be normalized)
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

// ✅ FIX: this was using appt.first_name / appt.last_name (not Acuity fields)
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

  // ✅ NEW: helper for Acuity appointments pagination by day
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

    // keep your teammate’s “week overlap” behavior for weekly calculations:
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

  // ---------------- Single loop aggregation ----------------
  const monthlyAgg: Record<
    string,
    { revenue: number; count: number; returning: number; new: number }
  > = {}
  const dailyAgg: Record<string, { revenue: number; count: number }> = {}
  const weeklyAgg: Record<
    string,
    {
      meta: any
      revenue: number
      tips: number
      expenses: number
      returning: number
      new: number
      numAppointments: number
      clientVisitMap: Record<string, number>
    }
  > = {}
  const serviceCounts: Record<
    string,
    { month: string; year: number; count: number; price: number }
  > = {}
  const dailyServiceCounts: Record<string, { date: string; count: number; price: number }> = {}
  const topClientsMap: Record<string, Record<string, any>> = {}
  const funnelMap: Record<string, Record<string, any>> = {}
  const funnelMapDaily: Record<string, Record<string, any>> = {}
  const monthlyClientMap: Record<string, Record<string, number>> = {}
  const monthlyWeekdayAgg: Record<string, number> = {}

  // per-client stats for acuity_clients
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
    }
  > = {}

  const referralKeywords = [
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
    'walk',
  ]
  const referralFilter = ['unknown', 'returning', 'return', 'returning client']

  // ✅ NEW: stable identity resolver instance for this user
  const identityResolver = makeClientIdentityResolver(user.id)

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

    // ✅ NEW: canonical identity that merges email/phone/name if any overlap
    const canonical = identityResolver.getCanonical(email, phone, nameKey)
    const clientKey = identityResolver.canonicalToClientId(canonical)

    const returning = await isReturningClient(
      supabase,
      user.id,
      email ?? undefined,
      phone ?? undefined,
      appt.firstName,
      appt.lastName
    )

    // ---------- per-client stats (acuity_clients) ----------
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
      }
    }

    const stats = clientStats[clientKey]
    stats.total_appointments += 1

    // fill missing identifiers if later appts have them
    if (!stats.email && email) stats.email = email
    if (!stats.phone && phone) stats.phone = phone
    if (!stats.first_name && appt.firstName) stats.first_name = appt.firstName
    if (!stats.last_name && appt.lastName) stats.last_name = appt.lastName

    if (!stats.first_appt || dayKey < stats.first_appt) stats.first_appt = dayKey
    if (!stats.last_appt || dayKey > stats.last_appt) stats.last_appt = dayKey

    // 3️⃣ Weekly
    const weekMeta = getWeekMetaForDate(apptDate)
    const weekKey = `${weekMeta.year}||${weekMeta.month}||${String(weekMeta.weekNumber).padStart(
      2,
      '0'
    )}||${weekMeta.weekStartISO}`

    if (!weeklyAgg[weekKey]) {
      weeklyAgg[weekKey] = {
        meta: weekMeta,
        revenue: 0,
        tips: 0,
        expenses: 0,
        numAppointments: 0,
        returning: 0,
        new: 0,
        clientVisitMap: {},
      }
    }

    const wEntry = weeklyAgg[weekKey]
    wEntry.revenue += price
    wEntry.numAppointments++

    if (!returning) {
      for (const form of appt.forms ?? []) {
        if (!form.values || !Array.isArray(form.values)) continue
        for (const field of form.values) {
          const fieldName = field.name?.toLowerCase() || ''
          const fieldValue = field.value?.toLowerCase() || ''
          if (!referralKeywords.some((k) => fieldName.includes(k))) continue
          if (referralFilter.some((k) => fieldValue.includes(k))) continue
          if (fieldValue === '') continue
          wEntry.new++
          break
        }
      }
    }

    if (!wEntry.clientVisitMap[clientKey]) wEntry.clientVisitMap[clientKey] = 0
    wEntry.clientVisitMap[clientKey]++

    // Skip appointments not in the requested month for monthly/daily stuff
    if (apptDate.getMonth() !== MONTHS.indexOf(requestedMonth!)) continue

    // Weekday aggregation
    const weekdayKey = parsed ? getWeekdayName(apptDate) : getWeekdayName(new Date(appt.datetime))
    const monthWeekdayKey = `${user.id}||${requestedYear}||${requestedMonth}||${weekdayKey}`
    if (!monthlyWeekdayAgg[monthWeekdayKey]) monthlyWeekdayAgg[monthWeekdayKey] = 0
    monthlyWeekdayAgg[monthWeekdayKey]++

    // 1️⃣ Monthly
    const monthKey = `${year}||${monthName}`
    if (!monthlyAgg[monthKey]) monthlyAgg[monthKey] = { revenue: 0, count: 0, returning: 0, new: 0 }
    monthlyAgg[monthKey].revenue += price
    monthlyAgg[monthKey].count++

    if (!returning) {
      for (const form of appt.forms ?? []) {
        if (!form.values || !Array.isArray(form.values)) continue
        for (const field of form.values) {
          const fieldName = field.name?.toLowerCase() || ''
          const fieldValue = field.value?.toLowerCase() || ''
          if (
            !referralKeywords.some((k) => fieldName.includes(k)) ||
            referralFilter.some((k) => fieldValue.includes(k)) ||
            fieldValue === ''
          )
            continue
          monthlyAgg[monthKey].new++
          break
        }
      }
    }

    // 2️⃣ Daily
    if (!dailyAgg[dayKey]) dailyAgg[dayKey] = { revenue: 0, count: 0 }
    dailyAgg[dayKey].revenue += price
    dailyAgg[dayKey].count++

    if (!monthlyClientMap[monthKey]) monthlyClientMap[monthKey] = {}
    if (!monthlyClientMap[monthKey][clientKey]) monthlyClientMap[monthKey][clientKey] = 0
    monthlyClientMap[monthKey][clientKey]++

    // 4️⃣ Service bookings
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

    // DAILY SERVICE COUNTS
    const dailySvcKey = `${cleanApptType || 'Unknown'}||${dayKey}`
    if (!dailyServiceCounts[dailySvcKey]) {
      dailyServiceCounts[dailySvcKey] = { date: dayKey, count: 0, price: appt.price }
    }
    dailyServiceCounts[dailySvcKey].count++

    // 5️⃣ Top clients
    if (!topClientsMap[monthKey]) topClientsMap[monthKey] = {}
    if (!topClientsMap[monthKey][clientKey]) {
      topClientsMap[monthKey][clientKey] = {
        client_name: nameDisplay || 'Unknown',
        email: email ?? '',
        phone: phone ?? '',
        client_key: clientKey,
        total_paid: 0,
        num_visits: 0,
        month: monthName,
        year,
      }
    }
    topClientsMap[monthKey][clientKey].total_paid += price
    topClientsMap[monthKey][clientKey].num_visits++
  }

  // -----------------------------------------------
  // ---------------- Batch upserts ----------------

  // Marketing funnels (kept)
  const funnelUpserts = Object.entries(funnelMap).flatMap(([monthKey, sources]) => {
    const [yearStr, month] = monthKey.split('||')
    return Object.entries(sources).map(([source, stats]) => ({
      user_id: user.id,
      source,
      new_clients: stats.newClients,
      returning_clients: stats.returningClients,
      retention:
        stats.newClients + stats.returningClients > 0
          ? (stats.returningClients / stats.newClients) * 100
          : 0,
      avg_ticket: stats.totalVisits > 0 ? stats.totalRevenue / stats.totalVisits : 0,
      report_month: month,
      report_year: parseInt(yearStr),
      created_at: new Date().toISOString(),
    }))
  })
  await supabase
    .from('marketing_funnels')
    .upsert(funnelUpserts, { onConflict: 'user_id,source,report_month,report_year' })

  // Monthly (kept)
  const monthlyUpserts = await Promise.all(
    Object.entries(monthlyAgg).map(async ([key, val]) => {
      const [yearStr, month] = key.split('||')

      const { data: newClientsFromFunnels } = await supabase
        .from('marketing_funnels')
        .select('new_clients')
        .eq('user_id', user.id)
        .eq('report_month', month)
        .eq('report_year', parseInt(yearStr))

      const totalNewClients =
        newClientsFromFunnels?.reduce((sum, row) => sum + (row.new_clients || 0), 0) || 0

      return {
        user_id: user.id,
        month,
        year: parseInt(yearStr),
        total_revenue: val.revenue,
        num_appointments: val.count,
        new_clients: totalNewClients,
        returning_clients: val.count - totalNewClients,
        unique_clients: uniqueClients.length,
        updated_at: new Date().toISOString(),
      }
    })
  )

  await supabase.from('monthly_data').upsert(monthlyUpserts, { onConflict: 'user_id,month,year' })

  // Daily (kept)
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

  // Weekly (kept)
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

      return {
        user_id: user.id,
        week_number: w.meta.weekNumber,
        start_date: w.meta.weekStartISO,
        end_date: w.meta.weekEndISO,
        total_revenue: w.revenue,
        expenses: w.expenses,
        num_appointments: w.numAppointments,
        new_clients: w.new,
        returning_clients: w.numAppointments - w.new,
        year: weekYear,
        month: weekMonth,
        created_at: c,
        updated_at: c,
      }
    })

  await supabase.from('weekly_data').upsert(weeklyUpserts, { onConflict: 'user_id,week_number,month,year' })

  // Weekly Top Clients (kept exactly)
  for (const w of Object.values(weeklyAgg)) {
    const weekMeta = w.meta
    const c = new Date().toISOString()
    if (weekMeta.month !== requestedMonth) continue

    const weekAppointments = appointments.filter((appt) => {
      const parsed = parseDateStringSafe(appt.datetime)
      if (!parsed) return false
      return parsed.dayKey >= weekMeta.weekStartISO && parsed.dayKey <= weekMeta.weekEndISO
    })

    const weeklyClientUpserts = Object.entries(w.clientVisitMap).map(([clientKey, visits]) => {
      const totalPaid = weekAppointments
        .filter((appt) => {
          const email = normEmail(appt.email) ?? ''
          const phone = normPhone(appt.phone) ?? ''
          const name = normName(appt.firstName ?? null, appt.lastName ?? null) ?? ''
          const rawKey = `${email}|${phone}|${name}`
          const key = crypto.createHash('sha256').update(rawKey).digest('hex')
          return key === clientKey
        })
        .reduce((sum, appt) => sum + parseFloat(appt.priceSold || '0'), 0)

      const apptClient = weekAppointments.find((appt) => {
        const email = normEmail(appt.email) ?? ''
        const phone = normPhone(appt.phone) ?? ''
        const name = normName(appt.firstName ?? null, appt.lastName ?? null) ?? ''
        const rawKey = `${email}|${phone}|${name}`
        const key = crypto.createHash('sha256').update(rawKey).digest('hex')
        return key === clientKey
      })

      return {
        user_id: user.id,
        client_name: apptClient ? `${apptClient.firstName || ''} ${apptClient.lastName || ''}`.trim() : 'Unknown',
        total_paid: totalPaid,
        num_visits: visits,
        email: apptClient?.email ?? '',
        phone: apptClient?.phone ?? '',
        client_key: clientKey,
        week_number: weekMeta.weekNumber,
        start_date: weekMeta.weekStartISO,
        end_date: weekMeta.weekEndISO,
        month: requestedMonth,
        year: requestedYear,
        updated_at: c,
        created_at: c,
        notes: apptClient?.notes ?? null,
      }
    })

    if (weeklyClientUpserts.length > 0) {
      const { error } = await supabase.from('weekly_top_clients').upsert(weeklyClientUpserts, {
        onConflict: 'user_id,week_number,month,year,client_key',
      })
      if (error) console.error('Weekly top clients upsert failed:', error)
    }
  }

  // Service bookings (kept)
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

  // Daily service bookings (kept)
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

  // Top clients (kept)
  for (const clients of Object.values(topClientsMap)) {
    const upserts = Object.values(clients).map((c) => ({
      ...c,
      user_id: user.id,
      updated_at: new Date().toISOString(),
    }))
    await supabase
      .from('report_top_clients')
      .upsert(upserts, { onConflict: 'user_id,month,year,client_key' })
  }

  // Daily marketing funnels (kept)
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

  const { error } = await supabase
    .from('daily_marketing_funnels')
    .upsert(dailyFunnelUpserts, { onConflict: 'user_id,source,report_date' })
    .select('*')

  if (error) console.error('Supabase upsert error:', error)

  // --------- ✅ FIXED: merge clientStats into acuity_clients without inflating totals ---------
  if (Object.keys(clientStats).length > 0) {
    const clientIds = Object.keys(clientStats)

    const { data: existingRows, error: existingErr } = await supabase
      .from('acuity_clients')
      .select('client_id, first_appt, last_appt, total_appointments, total_tips_all_time, email, phone, phone_normalized, first_name, last_name')
      .eq('user_id', user.id)
      .in('client_id', clientIds)

    if (existingErr) console.error('Error fetching existing acuity_clients:', existingErr)

    if (existingRows) {
      for (const row of existingRows) {
        const stats = clientStats[row.client_id]
        if (!stats) continue

        const prevFirst = (row.first_appt as string | null) ?? null
        if (prevFirst && (!stats.first_appt || prevFirst < stats.first_appt)) stats.first_appt = prevFirst

        const prevLast = (row.last_appt as string | null) ?? null
        if (prevLast && (!stats.last_appt || prevLast > stats.last_appt)) stats.last_appt = prevLast

        // ✅ DO NOT add totals (that double-counts on reruns).
        // Keep whichever is larger. This avoids “shrinking” when syncing partial months.
        const prevTotal = (row.total_appointments as number | null) ?? 0
        if (prevTotal > stats.total_appointments) stats.total_appointments = prevTotal

        const prevTips = (row.total_tips_all_time as number | null) ?? 0
        if (prevTips > stats.total_tips_all_time) stats.total_tips_all_time = prevTips

        // preserve identifiers if DB has them but current month didn’t
        if (!stats.email && row.email) stats.email = row.email
        if (!stats.phone && (row.phone_normalized || row.phone)) stats.phone = (row.phone_normalized || row.phone) as string
        if (!stats.first_name && row.first_name) stats.first_name = row.first_name
        if (!stats.last_name && row.last_name) stats.last_name = row.last_name
      }
    }

    const clientUpserts = Object.values(clientStats).map((s) => ({
      user_id: user.id,
      client_id: s.client_id,
      first_name: s.first_name,
      last_name: s.last_name,
      email: s.email,
      phone: s.phone,
      phone_normalized: s.phone, // keep digits
      first_appt: s.first_appt,
      last_appt: s.last_appt,
      total_appointments: s.total_appointments,
      total_tips_all_time: s.total_tips_all_time,
      updated_at: new Date().toISOString(),
    }))

    const { error: clientErr } = await supabase
      .from('acuity_clients')
      .upsert(clientUpserts, { onConflict: 'user_id,client_id' })

    if (clientErr) console.error('Error upserting acuity_clients:', clientErr)
  }

  // Weekday summary (kept)
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
