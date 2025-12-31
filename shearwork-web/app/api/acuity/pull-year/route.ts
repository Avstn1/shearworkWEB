/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { NextResponse } from 'next/server'
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

async function handleSync(request: Request) {
  // Create Supabase client with service role key (bypasses RLS)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Missing Supabase configuration' }, { status: 500 })
  }

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  const { searchParams } = new URL(request.url)
  const requestedYear = searchParams.get('year')
    ? parseInt(searchParams.get('year') as string, 10)
    : null
  const userId = searchParams.get('user_id')

  if (!requestedYear) {
    return NextResponse.json({ error: 'Year parameter required' }, { status: 400 })
  }

  if (!userId) {
    return NextResponse.json({ error: 'user_id parameter required' }, { status: 400 })
  }

  console.log(`\n=== STARTING YEAR SYNC: ${requestedYear} for user ${userId} ===`)

  const { data: tokenRow } = await supabase
    .from('acuity_tokens')
    .select('*')
    .eq('user_id', userId)
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
          .eq('user_id', userId)
      } else {
        return NextResponse.json({ error: 'Token refresh failed' }, { status: 500 })
      }
    } catch (err) {
      return NextResponse.json({ error: 'Failed to refresh token' }, { status: 500 })
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('calendar')
    .eq('user_id', userId)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'No profile found' }, { status: 400 })
  }

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

  // Load existing clients into cache
  const { data: existingClients } = await supabase
    .from('acuity_clients')
    .select('client_id, email, phone_normalized, first_name, last_name')
    .eq('user_id', userId)

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

    appointmentsToUpsert.push({
      user_id: userId,
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
  }

  console.log(`Unique clients found: ${clientDataMap.size}`)
  console.log(`Appointments to upsert: ${appointmentsToUpsert.length}`)

  // Batch upsert appointments with revenue/tip preservation
  if (appointmentsToUpsert.length > 0) {
    const acuityTips: Record<string, number> = {}
    const acuityRevenue: Record<string, number> = {}
    
    const cleanedAppointments = appointmentsToUpsert.map(appt => {
      const { _acuity_tip, _acuity_revenue, ...rest } = appt
      acuityTips[appt.acuity_appointment_id] = _acuity_tip || 0
      acuityRevenue[appt.acuity_appointment_id] = _acuity_revenue || 0
      return rest
    })
    
    console.log('Upserting appointments...')
    
    const { data: upsertedAppts, error } = await supabase
      .from('acuity_appointments')
      .upsert(cleanedAppointments, { onConflict: 'user_id,acuity_appointment_id' })
      .select('id, acuity_appointment_id, tip, revenue')
    
    if (error) {
      console.error('Appointment upsert error:', error)
    } else if (upsertedAppts && upsertedAppts.length > 0) {
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
        }
      }
    }
  }

  // Use RPC function for efficient client totals calculation
  console.log('Calculating client totals...')
  const { data: clientTotalsData } = await supabase
    .rpc('calculate_client_appointment_stats', { p_user_id: userId })

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

  // Build client upserts with fallback totals fetch
  console.log('Preparing client upserts...')
  const clientUpserts = await Promise.all(
    Array.from(clientDataMap.values()).map(async (client) => {
      let totals = clientTotals[client.client_id]
      
      if (!totals) {
        const { data: appts } = await supabase
          .from('acuity_appointments')
          .select('appointment_date, tip')
          .eq('user_id', userId)
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
          totals = {
            total_appointments: 0,
            total_tips_all_time: 0,
            first_appt: client.first_appt,
            last_appt: client.last_appt,
          }
        }
      }
      
      return {
        user_id: userId,
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

  // Update existing clients that weren't in this sync batch
  const existingClientIds = new Set(clientUpserts.map(c => c.client_id))
  
  for (const [clientId, totals] of Object.entries(clientTotals)) {
    if (!existingClientIds.has(clientId)) {
      await supabase
        .from('acuity_clients')
        .update({
          first_appt: totals.first_appt,
          last_appt: totals.last_appt,
          total_appointments: totals.total_appointments,
          total_tips_all_time: Math.min(totals.total_tips_all_time || 0, 999.99),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('client_id', clientId)
    }
  }

  // Upsert clients (preserving date_last_sms_sent, sms_subscribed, visiting_type, avg_weekly_visits, notes)
  console.log('Upserting clients...')
  if (clientUpserts.length > 0) {
    await supabase
      .from('acuity_clients')
      .upsert(clientUpserts, { onConflict: 'user_id,client_id' })
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

export async function GET(request: Request) {
  return handleSync(request)
}

export async function POST(request: Request) {
  return handleSync(request)
}