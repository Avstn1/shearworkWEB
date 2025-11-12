'use server'

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import crypto from 'crypto'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

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
      const dt = new Date(datetime)
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
  const day = d.getDay() // Sunday=0, Monday=1, ...
  const diff = (day === 0 ? -6 : 1 - day) // shift back to Monday
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
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
  const diff = day === 0 ? 1 : (8 - day) % 7 // next Monday if day != Monday
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
  const diffDays = Math.round((weekStartDate.getTime() - firstMonday.getTime()) / (1000 * 60 * 60 * 24))
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
    year: weekYear 
  }
}


export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const requestedMonth = searchParams.get('month') || null
  const requestedYear = searchParams.get('year') ? parseInt(searchParams.get('year') as string, 10) : null

  // Fetch token
  const { data: tokenRow } = await supabase.from('acuity_tokens').select('*').eq('user_id', user.id).single()
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
        await supabase.from('acuity_tokens').update({
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token ?? tokenRow.refresh_token,
          expires_at: nowSec + newTokens.expires_in,
          updated_at: new Date().toISOString(),
        }).eq('user_id', user.id)
      } else return NextResponse.json({ error: 'Token refresh failed', details: newTokens }, { status: 500 })
    } catch (err) {
      return NextResponse.json({ error: 'Failed to refresh token', details: String(err) })
    }
  }

  // Fetch appointments
  let allData: any[] = []
  if (requestedMonth && requestedYear) {
    const start = new Date(`${requestedMonth} 1, ${requestedYear}`)
    const end = new Date(start)
    end.setMonth(end.getMonth() + 1)
    end.setDate(7) // Fetch up to the 7th of the next month to catch overlapping weeks
    const today = new Date()
    if (end > today) end.setFullYear(today.getFullYear(), today.getMonth(), today.getDate())

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayStr = d.toISOString().split('T')[0]
      const dayUrl = new URL('https://acuityscheduling.com/api/v1/appointments')
      dayUrl.searchParams.set('minDate', dayStr)
      dayUrl.searchParams.set('maxDate', dayStr)
      dayUrl.searchParams.set('max', '100')
      const dayRes = await fetch(dayUrl.toString(), { headers: { Authorization: `Bearer ${accessToken}` } })
      const dayData = await dayRes.json()
      if (Array.isArray(dayData)) allData.push(...dayData)
    }
  }

  const now = new Date()
  const appointments = allData.filter(a => new Date(a.datetime) <= now)

  // ---------------- Single loop aggregation ----------------
  const monthlyAgg: Record<string, { revenue: number; count: number; returning: number, new: number }> = {}
  const dailyAgg: Record<string, { revenue: number; count: number }> = {}
  const weeklyAgg: Record<string, { meta: any; revenue: number; tips: number; expenses: number; returning: number; new: number; numAppointments: number; clientVisitMap: Record<string, number> }> = {}
  const serviceCounts: Record<string, { month: string; year: number; count: number; price: number }> = {}
  const topClientsMap: Record<string, Record<string, any>> = {}
  const funnelMap: Record<string, Record<string, any>> = {}
  const monthlyClientMap: Record<string, Record<string, number>> = {}
  const referralKeywords = ['referral', 'referred', 'hear', 'heard', 'source', 'social', 'instagram', 'facebook', 'tiktok']

  for (const appt of appointments) {
    const parsed = parseDateStringSafe(appt.datetime)
    const apptDate = parsed ? new Date(`${parsed.dayKey}T00:00:00`) : new Date(appt.datetime)
    if (!apptDate || isNaN(apptDate.getTime())) continue
    // Use the requested month/year as the canonical ones
    const year = requestedYear!
    const monthName = requestedMonth!
    const dayKey = parsed?.dayKey || apptDate.toISOString().split('T')[0]
    const price = parseFloat(appt.priceSold || '0')
    const name = appt.firstName && appt.lastName ? `${appt.firstName} ${appt.lastName}`.trim() : ''
    const email = (appt.email || '').toLowerCase().trim()
    const phone = (appt.phone || '').replace(/\D/g, '')

    // Skip entirely if no identifying info
    if (!name && !email && !phone) continue

    const rawKey = `${email}|${phone}|${name}` 
    const clientKey = crypto.createHash('sha256').update(rawKey).digest('hex')

    // 3️⃣ Weekly
    const weekMeta = getWeekMetaForDate(apptDate)
    const weekKey = `${weekMeta.year}||${weekMeta.month}||${String(weekMeta.weekNumber).padStart(2,'0')}||${weekMeta.weekStartISO}`
    if (!weeklyAgg[weekKey]) weeklyAgg[weekKey] = {
      meta: weekMeta, revenue: 0, tips: 0, expenses: 0, numAppointments: 0, returning: 0, new: 0, clientVisitMap: {}
    }
    const wEntry = weeklyAgg[weekKey]
    wEntry.revenue += price
    wEntry.numAppointments++
   
    if (!wEntry.clientVisitMap[clientKey]) wEntry.clientVisitMap[clientKey] = 0
    wEntry.clientVisitMap[clientKey]++

    // Skip appointments not in the requested month
    if (apptDate.getMonth() !== MONTHS.indexOf(requestedMonth!)) continue

    // 1️⃣ Monthly
    const monthKey = `${year}||${monthName}`
    if (!monthlyAgg[monthKey]) monthlyAgg[monthKey] = { revenue: 0, count: 0, returning: 0, new: 0 } 
    
    monthlyAgg[monthKey].revenue += price
    monthlyAgg[monthKey].count++

    // 2️⃣ Daily
    if (!dailyAgg[dayKey]) dailyAgg[dayKey] = { revenue: 0, count: 0 }
    dailyAgg[dayKey].revenue += price
    dailyAgg[dayKey].count++

    // Track visits per client for the month
    if (!monthlyClientMap[monthKey]) monthlyClientMap[monthKey] = {}
    if (!monthlyClientMap[monthKey][clientKey]) monthlyClientMap[monthKey][clientKey] = 0
    monthlyClientMap[monthKey][clientKey]++

    // 4️⃣ Service bookings
    const svcKey = `${appt.type || 'Unknown'}||${monthName}||${year}`
    if (!serviceCounts[svcKey]) serviceCounts[svcKey] = { month: monthName, year, count: 0, price: appt.price }
    serviceCounts[svcKey].count++

    // 5️⃣ Top clients
    if (!topClientsMap[monthKey]) topClientsMap[monthKey] = {}
    if (!topClientsMap[monthKey][clientKey]) topClientsMap[monthKey][clientKey] = { client_name: name, email, phone, client_key: clientKey, total_paid: 0, num_visits: 0, month: monthName, year }
    topClientsMap[monthKey][clientKey].total_paid += price
    topClientsMap[monthKey][clientKey].num_visits++

    // 6️⃣ Marketing funnels (only for the requested month)
    if (!appt.forms || !Array.isArray(appt.forms)) continue
    for (const form of appt.forms) {
      if (!form.values || !Array.isArray(form.values)) continue

      for (const field of form.values) {
        const fieldName = field.name?.toLowerCase() || ''
        if (!referralKeywords.some(k => fieldName.includes(k))) continue

        const rawValue = (field.value || '').trim()
        if (!rawValue || rawValue.includes(',')) continue

        if (!funnelMap[monthKey]) funnelMap[monthKey] = {}
        if (!funnelMap[monthKey][rawValue]) {
          funnelMap[monthKey][rawValue] = {
            newClients: 0,
            returningClients: 0,
            totalRevenue: 0,
            totalVisits: 0,
            seenClients: new Set<string>() // 👈 track unique clients
          }
        }

        const funnel = funnelMap[monthKey][rawValue]
        const clientId =
          (appt.email?.toLowerCase() ||
          appt.phone?.replace(/\D/g, '') ||
          `${appt.firstName} ${appt.lastName}`.trim().toLowerCase())

        if (!clientId) continue

        // ✅ Add to "new clients" if first time this client appears in this funnel
        if (!funnel.seenClients.has(clientId)) {
          funnel.newClients++
          funnel.seenClients.add(clientId)
        }

        // ✅ Check if this client has any *past* appointments (returning logic)
        const isReturning = appointments.some(other => {
          const parsedOther = parseDateStringSafe(other.datetime)
          if (!parsedOther) return false
          const otherMonthKey = `${parsedOther.year}||${parsedOther.monthName}`
          if (otherMonthKey !== monthKey) return false

          const otherDate = new Date(other.datetime)
          if (otherDate >= apptDate) return false

          const sameEmail = appt.email && other.email && other.email.toLowerCase() === appt.email.toLowerCase()
          const samePhone = appt.phone && other.phone && other.phone.replace(/\D/g, '') === appt.phone.replace(/\D/g, '')
          const sameName = appt.firstName && appt.lastName && other.firstName && other.lastName &&
                          `${other.firstName} ${other.lastName}`.trim().toLowerCase() ===
                          `${appt.firstName} ${appt.lastName}`.trim().toLowerCase()

          return sameEmail || samePhone || sameName
        })

        if (isReturning) funnel.returningClients++ // 👈 Now a subset, not alternative

        funnel.totalRevenue += price
        funnel.totalVisits++
        break
      }
    }
  }

  // ---------------- Batch upserts ----------------
  // Monthly
  const monthlyUpserts = Object.entries(monthlyAgg).map(([key, val]) => {
    const [yearStr, month] = key.split('||')

    return {
      user_id: user.id,
      month,
      year: parseInt(yearStr),
      total_revenue: val.revenue,
      num_appointments: val.count,
      new_clients: val.new,
      returning_clients: val.returning,
      updated_at: new Date().toISOString()
    }
  })

  await supabase.from('monthly_data').upsert(monthlyUpserts, { onConflict: 'user_id,month,year' })

  // Daily
  for (const [day, val] of Object.entries(dailyAgg)) {
    const [y, m] = day.split('-').map(Number)
    const month = MONTHS[m - 1]
    const year = y
    const existing = await supabase.from('daily_data').select('id').eq('user_id', user.id).eq('date', day).maybeSingle()
    if (existing.data?.id) {
      await supabase.from('daily_data').update({ total_revenue: val.revenue, num_appointments: val.count, month, year, updated_at: new Date().toISOString() }).eq('id', existing.data.id)
    } else {
      await supabase.from('daily_data').insert([{ user_id: user.id, date: day, total_revenue: val.revenue, num_appointments: val.count, month, year, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }])
    }
  }

  // Weekly
  // Instead of filtering out weeks outside the requestedMonth,
  // include any week that *intersects* with the requested month range.
  const weeklyUpserts = Object.values(weeklyAgg)
    .filter(w => {
      const weekStart = new Date(w.meta.weekStartISO)
      const weekEnd = new Date(w.meta.weekEndISO)
      const startOfMonth = new Date(`${requestedMonth} 1, ${requestedYear}`)
      const endOfMonth = new Date(startOfMonth)
      endOfMonth.setMonth(endOfMonth.getMonth() + 1)
      endOfMonth.setDate(0)

      // ✅ Include only weeks that *start* inside the month
      // but may extend (overflow) into the next month.
      return weekStart >= startOfMonth && weekStart <= endOfMonth
    })
    .map(w => {
      let newClients = 0, returningClients = 0
      for (const v of Object.values(w.clientVisitMap)) v >= 2 ? returningClients++ : newClients++
      const c = new Date().toISOString()

      // Keep the canonical year/month for labeling
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
        returning_clients: w.returning, 
        year: weekYear, 
        month: weekMonth, 
        created_at: c, 
        updated_at: c 
      }
    })

  await supabase.from('weekly_data').upsert(weeklyUpserts, { onConflict: 'user_id,start_date,week_number,month,year' })


// ---------------- Weekly Top Clients (corrected total_paid) ----------------
for (const w of Object.values(weeklyAgg)) {
  const weekMeta = w.meta
  const c = new Date().toISOString()
  if (weekMeta.month !== requestedMonth) continue

  // Filter appointments that fall into this week
  const weekAppointments = appointments.filter(appt => {
    const parsed = parseDateStringSafe(appt.datetime)
    if (!parsed) return false
    // Compare ISO strings instead of full dates
    return parsed.dayKey >= weekMeta.weekStartISO && parsed.dayKey <= weekMeta.weekEndISO
  })

  const weeklyClientUpserts = Object.entries(w.clientVisitMap).map(([clientKey, visits]) => {
    // Sum total_paid for this client in this week only
    const totalPaid = weekAppointments
      .filter(appt => {
        const email = (appt.email || '').toLowerCase().trim()
        const phone = (appt.phone || '').replace(/\D/g, '')
        const name = appt.firstName && appt.lastName
          ? `${appt.firstName} ${appt.lastName}`.trim()
          : ''

        const rawKey = `${email}|${phone}|${name}`
        const key = crypto.createHash('sha256').update(rawKey).digest('hex')
        return key === clientKey
      })
      .reduce((sum, appt) => sum + parseFloat(appt.priceSold || '0'), 0)

    const apptClient = weekAppointments.find(appt => {
      const email = (appt.email || '').toLowerCase().trim()
      const phone = (appt.phone || '').replace(/\D/g, '')
      const name = appt.firstName && appt.lastName
        ? `${appt.firstName} ${appt.lastName}`.trim()
        : ''
      const rawKey = `${email}|${phone}|${name}`
      const key = crypto.createHash('sha256').update(rawKey).digest('hex')
      return key === clientKey
    })
    return {
      user_id: user.id,
      client_name: apptClient
        ? `${apptClient.firstName || ''} ${apptClient.lastName || ''}`.trim()
        : 'Unknown',
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
    const { error } = await supabase
      .from('weekly_top_clients')
      .upsert(weeklyClientUpserts, { onConflict: 'user_id,week_number,month,year,client_key' })
    if (error) console.error('Weekly top clients upsert failed:', error)
  }
}

  // Service bookings
  const serviceUpserts = Object.entries(serviceCounts).map(([key, val]) => {
    const [service, month, yearStr] = key.split('||')
    return { user_id: user.id, service_name: service, bookings: val.count, price: val.price, report_month: month, report_year: parseInt(yearStr), created_at: new Date().toISOString() }
  })
  await supabase.from('service_bookings').upsert(serviceUpserts, { onConflict: 'user_id,service_name,report_month,report_year' })

  // Top clients
  for (const clients of Object.values(topClientsMap)) {
    const upserts = Object.values(clients).map(c => ({ ...c, user_id: user.id, updated_at: new Date().toISOString() }))
    await supabase.from('report_top_clients').upsert(upserts, { onConflict: 'user_id,month,year,client_key' })
  }

  // Marketing funnels
  const funnelUpserts = Object.entries(funnelMap).flatMap(([monthKey, sources]) => {
    const [yearStr, month] = monthKey.split('||')
    return Object.entries(sources).map(([source, stats]) => ({
      user_id: user.id,
      source,
      new_clients: stats.newClients,
      returning_clients: stats.returningClients,
      retention: stats.newClients + stats.returningClients > 0 ? (stats.returningClients / stats.newClients) * 100 : 0,
      avg_ticket: stats.totalVisits > 0 ? stats.totalRevenue / stats.totalVisits : 0,
      report_month: month,
      report_year: parseInt(yearStr),
      created_at: new Date().toISOString(),
    }))
  })
  await supabase.from('marketing_funnels').upsert(funnelUpserts, { onConflict: 'user_id,source,report_month,report_year' })

  return NextResponse.json({ endpoint: 'appointments', fetched_at: new Date().toISOString(), acuity_data: appointments })
}
