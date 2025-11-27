'use server'

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import crypto from 'crypto'
import {
  MONTHS,
  AcuityAppointment,
  buildMonthlyTimeframes,
  computeFunnelsFromAppointments,
  normalizePhone,
} from '@/lib/marketingFunnels'

// ✅ Helper to safely get all days of a month in UTC context
function getAllDatesInMonth(monthName: string, year: number): string[] {
  const monthIndex = MONTHS.indexOf(monthName)
  const start = new Date(Date.UTC(year, monthIndex, 1))
  const end = new Date(Date.UTC(year, monthIndex + 1, 0))
  const today = new Date()

  // if this month goes into the future, clamp to today
  if (end > today) {
    end.setUTCFullYear(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    )
  }

  const dates: string[] = []
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]) // YYYY-MM-DD in UTC
  }
  return dates
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient()

  // 🔽 NEW: allow explicit year (query or JSON body), fallback to current year
  let requestedYear: number
  try {
    const url = new URL(req.url)
    const yearFromQuery = url.searchParams.get('year')

    if (yearFromQuery) {
      requestedYear = parseInt(yearFromQuery, 10)
    } else {
      const body = await req
        .json()
        .catch(() => null) as { year?: number | string } | null
      const yearFromBody = body?.year
      if (yearFromBody) {
        requestedYear = parseInt(String(yearFromBody), 10)
      } else {
        const now = new Date()
        requestedYear = now.getUTCFullYear()
      }
    }

    if (!requestedYear || Number.isNaN(requestedYear)) {
      const now = new Date()
      requestedYear = now.getUTCFullYear()
    }
  } catch {
    const now = new Date()
    requestedYear = now.getUTCFullYear()
  }
  // 🔼 END: requestedYear is now flexible

  // 1️⃣ Fetch all connected users
  const { data: tokenRows, error: tokenError } = await supabase
    .from('acuity_tokens')
    .select('*')

  if (tokenError || !tokenRows?.length) {
    return NextResponse.json(
      { error: 'No Acuity connections found' },
      { status: 400 },
    )
  }

  const results: Record<string, any> = {}

  for (const tokenRow of tokenRows) {
    const userId = tokenRow.user_id
    let accessToken = tokenRow.access_token
    const nowTs = Math.floor(Date.now() / 1000)

    // 🔁 Refresh token if expired
    if (tokenRow.expires_at && tokenRow.expires_at < nowTs) {
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
              refresh_token:
                newTokens.refresh_token ?? tokenRow.refresh_token,
              expires_at: nowTs + newTokens.expires_in,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId)
        } else {
          results[userId] = {
            error: 'Token refresh failed',
            details: newTokens,
          }
          continue
        }
      } catch (err) {
        results[userId] = {
          error: 'Failed to refresh token',
          details: String(err),
        }
        continue
      }
    }

    // 📅 Fetch appointments for every month in requestedYear (day by day)
    let allData: any[] = []
    try {
      for (const monthName of MONTHS) {
        const dates = getAllDatesInMonth(monthName, requestedYear)
        for (const day of dates) {
          const url = new URL(
            'https://acuityscheduling.com/api/v1/appointments',
          )
          url.searchParams.set('minDate', day)
          url.searchParams.set('maxDate', day)
          url.searchParams.set('max', '100')
          const res = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          const dayData = await res.json()
          if (res.ok && Array.isArray(dayData)) allData.push(...dayData)
        }
      }
    } catch (err) {
      results[userId] = {
        error: 'Failed to fetch Acuity data',
        details: String(err),
      }
      continue
    }

    if (allData.length === 0) {
      results[userId] = { fetched: 0, year: requestedYear }
      continue
    }

    // 🧮 Process data (monthly_data, service_bookings, report_top_clients)
    const groupedByMonth: Record<string, any[]> = {}

    for (const appt of allData) {
      const date = new Date(appt.datetime)
      const monthName = MONTHS[date.getUTCMonth()]
      const yearNum = date.getUTCFullYear()
      const key = `${yearNum}||${monthName}`
      if (!groupedByMonth[key]) groupedByMonth[key] = []
      groupedByMonth[key].push(appt)
    }

    const revenueByMonth: Record<string, number> = {}
    const numAppointmentsByMonth: Record<string, number> = {}

    for (const [key, appts] of Object.entries(groupedByMonth)) {
      const totalRevenue = appts.reduce(
        (sum, a) => sum + parseFloat(a.priceSold || '0'),
        0,
      )
      revenueByMonth[key] = totalRevenue
      numAppointmentsByMonth[key] = appts.length
    }

    const upsertRows = Object.keys(revenueByMonth).map((key) => {
      const [yearStr, monthName] = key.split('||')
      return {
        user_id: userId,
        month: monthName,
        year: parseInt(yearStr),
        total_revenue: revenueByMonth[key],
        num_appointments: numAppointmentsByMonth[key],
        updated_at: new Date().toISOString(),
      }
    })

    await supabase
      .from('monthly_data')
      .upsert(upsertRows, { onConflict: 'user_id,month,year' })

    // 🧾 Service Bookings
    const serviceCounts: Record<
      string,
      { month: string; year: number; count: number }
    > = {}

    for (const appt of allData) {
      const service = appt.type || 'Unknown'
      const date = new Date(appt.datetime)
      const monthName = MONTHS[date.getUTCMonth()]
      const yearNum = date.getUTCFullYear()
      const key = `${service}||${monthName}||${yearNum}`
      if (!serviceCounts[key])
        serviceCounts[key] = { month: monthName, year: yearNum, count: 0 }
      serviceCounts[key].count++
    }

    const monthYearMap: Record<string, Record<string, number>> = {}
    for (const [key, val] of Object.entries(serviceCounts)) {
      const [service, monthName, yearStr] = key.split('||')
      const combo = `${monthName}||${yearStr}`
      if (!monthYearMap[combo]) monthYearMap[combo] = {}
      monthYearMap[combo][service] = val.count
    }

    const finalUpserts: any[] = []
    for (const [combo, services] of Object.entries(monthYearMap)) {
      const [monthName, yearStr] = combo.split('||')
      const yearNum = parseInt(yearStr)
      const sorted = Object.entries(services).sort((a, b) => b[1] - a[1])
      const top5 = sorted.slice(0, 5)
      const others = sorted.slice(5)
      let otherCount = 0
      for (const [, count] of others) otherCount += count

      for (const [service, count] of top5) {
        finalUpserts.push({
          user_id: userId,
          service_name: service,
          bookings: count,
          report_month: monthName,
          report_year: yearNum,
          created_at: new Date().toISOString(),
        })
      }
      if (otherCount > 0) {
        finalUpserts.push({
          user_id: userId,
          service_name: 'Other',
          bookings: otherCount,
          report_month: monthName,
          report_year: yearNum,
          created_at: new Date().toISOString(),
        })
      }
    }

    await supabase.from('service_bookings').upsert(finalUpserts, {
      onConflict: 'user_id,service_name,report_month,report_year',
    })

    // 🧍 Top Clients
    const monthlyClientMap: Record<string, Record<string, any>> = {}

    for (const appt of allData) {
      const date = new Date(appt.datetime)
      const monthName = MONTHS[date.getUTCMonth()]
      const yearNum = date.getUTCFullYear()
      const key = `${yearNum}||${monthName}`

      const name =
        appt.firstName && appt.lastName
          ? `${appt.firstName} ${appt.lastName}`
          : 'Unknown'
      const email = appt.email?.toLowerCase().trim() || null
      const phone = appt.phone?.replace(/\D/g, '') || null
      const clientKeySource = `${email || ''}|${phone || ''}|${name.toLowerCase()}`
      const clientKey = crypto
        .createHash('md5')
        .update(clientKeySource)
        .digest('hex')

      if (!monthlyClientMap[key]) monthlyClientMap[key] = {}
      if (!monthlyClientMap[key][clientKey]) {
        monthlyClientMap[key][clientKey] = {
          client_name: name,
          email,
          phone,
          client_key: clientKey,
          total_paid: 0,
          num_visits: 0,
          month: monthName,
          year: yearNum,
        }
      }

      monthlyClientMap[key][clientKey].total_paid += parseFloat(
        appt.priceSold || '0',
      )
      monthlyClientMap[key][clientKey].num_visits += 1
    }

    for (const clients of Object.values(monthlyClientMap)) {
      const upsertClients = Object.values(clients).map((c) => ({
        user_id: userId,
        client_name: c.client_name,
        email: c.email,
        phone: c.phone,
        client_key: c.client_key,
        total_paid: c.total_paid,
        num_visits: c.num_visits,
        month: c.month,
        year: c.year,
        updated_at: new Date().toISOString(),
      }))
      await supabase.from('report_top_clients').upsert(upsertClients, {
        onConflict: 'user_id,month,year,client_key',
      })
    }

    // 📈 Marketing Funnels (monthly) – unified logic with yearly_marketing_funnels
    // 1) Build monthly timeframes for requestedYear
    const tfDefs = buildMonthlyTimeframes(requestedYear)

    // 2) Load earliest first_appt per identity from acuity_clients for this user
    const { data: clientRows, error: clientErr } = await supabase
      .from('acuity_clients')
      .select('email, phone, first_name, last_name, first_appt')
      .eq('user_id', userId)

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

    // 3) Compute funnels using shared helper
    const funnels = computeFunnelsFromAppointments(
      allData as AcuityAppointment[],
      userId,
      firstApptLookup,
      tfDefs,
    )

    // 4) Build upserts for marketing_funnels
    const funnelUpserts: any[] = []

    for (const tf of tfDefs) {
      const tfStats = funnels[tf.id]
      if (!tfStats) continue

      for (const [source, stats] of Object.entries(tfStats)) {
        const retention =
          stats.new_clients > 0
            ? (stats.returning_clients / stats.new_clients) * 100
            : 0
        const avg_ticket =
          stats.total_visits > 0
            ? stats.total_revenue / stats.total_visits
            : 0

        funnelUpserts.push({
          user_id: userId,
          source,
          new_clients: stats.new_clients,
          returning_clients: stats.returning_clients,
          retention,
          avg_ticket,
          report_month: tf.id, // month name
          report_year: requestedYear,
          created_at: new Date().toISOString(),
        })
      }
    }

    if (funnelUpserts.length > 0) {
      await supabase.from('marketing_funnels').upsert(funnelUpserts, {
        onConflict: 'user_id,source,report_month,report_year',
      })
    }

    results[userId] = { fetched: allData.length, year: requestedYear }
  }

  // 🪵 Log Cron
  try {
    await supabase.from('cron_logs').insert({
      job_name: 'weekly_acuity_sync',
      success: true,
      processed_users: tokenRows.length,
      details: results,
    })
  } catch (logErr) {
    console.error('Failed to log cron run:', logErr)
  }

  return NextResponse.json({
    message: `Processed ${tokenRows.length} users for ${requestedYear}`,
    results,
  })
}
