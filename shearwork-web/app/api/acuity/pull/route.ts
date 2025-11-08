'use server'

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import crypto from 'crypto'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

// Helper to compute start/end dates of selected month/year
function getMonthRange(monthName: string, year: number) {
  const start = new Date(`${monthName} 1, ${year}`)
  const end = new Date(start)
  end.setMonth(start.getMonth() + 1)
  end.setDate(0) // last day of the month

  const today = new Date()
  if (end > today) {
    end.setFullYear(today.getFullYear(), today.getMonth(), today.getDate())
    end.setHours(today.getHours(), today.getMinutes(), today.getSeconds(), today.getMilliseconds())
  }

  const minDate = start.toISOString().split('T')[0]
  const maxDate = end.toISOString().split('T')[0]
  return { minDate, maxDate }
}

// Helper to get array of all dates in a month (stops at today)
function getAllDatesInMonth(monthName: string, year: number): string[] {
  const start = new Date(`${monthName} 1, ${year}`)
  const end = new Date(start)
  end.setMonth(end.getMonth() + 1)
  end.setDate(0)

  const today = new Date()
  if (end > today) {
    end.setFullYear(today.getFullYear(), today.getMonth(), today.getDate())
  }

  const dates: string[] = []
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toLocaleDateString('en-CA'))
  }
  return dates
}

// Safe date parsing helper: avoids timezone shifting by parsing YYYY-MM-DD
function parseDateStringSafe(datetime: string | undefined | null) {
  // Accepts ISO-like strings such as "2025-11-01T12:34:56Z" or "2025-11-01"
  if (!datetime) return null
  try {
    const datePart = datetime.split('T')[0] // "YYYY-MM-DD"
    const [yStr, mStr, dStr] = datePart.split('-')
    const y = Number(yStr)
    const m = Number(mStr)
    const d = Number(dStr)
    if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) throw new Error('invalid parts')
    const monthName = MONTHS[m - 1] || 'Unknown'
    const dayKey = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    return { year: y, monthIndex: m, monthName, dayKey, day: d }
  } catch (err) {
    // fallback to Date object if parsing fails
    try {
      const dt = new Date(datetime)
      const y = dt.getUTCFullYear()
      const m = dt.getUTCMonth() + 1
      const d = dt.getUTCDate()
      const monthName = MONTHS[m - 1] || 'Unknown'
      const dayKey = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      return { year: y, monthIndex: m, monthName, dayKey, day: d }
    } catch (e) {
      return null
    }
  }
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get('endpoint') || 'appointments'
  const requestedMonth = searchParams.get('month') || null
  const requestedYear = searchParams.get('year') ? parseInt(searchParams.get('year') as string, 10) : null

  // 2️⃣ Fetch token from DB
  const { data: tokenRow, error: tokenError } = await supabase
    .from('acuity_tokens')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (tokenError || !tokenRow) {
    return NextResponse.json({ error: 'No Acuity connection found' }, { status: 400 })
  }

  // 3️⃣ Refresh token if expired
  let accessToken = tokenRow.access_token
  const now = Math.floor(Date.now() / 1000)

  if (tokenRow.expires_at && tokenRow.expires_at < now) {
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
            expires_at: now + newTokens.expires_in,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
      } else {
        console.error('Token refresh failed:', newTokens)
        return NextResponse.json({ error: 'Token refresh failed', details: newTokens }, { status: 500 })
      }
    } catch (err) {
      return NextResponse.json({ error: 'Failed to refresh token', details: String(err) })
    }
  }

  // 4️⃣ Validate endpoint
  const ALLOWED_ENDPOINTS = [
    'appointments',
    'clients',
    'calendars',
    'appointment-types',
    'availability',
    'blocks',
    'categories',
    'forms',
    'packages',
    'products',
  ]

  if (!ALLOWED_ENDPOINTS.includes(endpoint)) {
    return NextResponse.json({ error: `Invalid endpoint '${endpoint}'` }, { status: 400 })
  }

  // 5️⃣ Fetch data from Acuity
  let allData: any[] = []

  try {
    if (endpoint === 'appointments' && requestedMonth && requestedYear) {
      const dates = getAllDatesInMonth(requestedMonth, requestedYear)

      for (const day of dates) {
        const dayUrl = new URL(`https://acuityscheduling.com/api/v1/appointments`)
        dayUrl.searchParams.set('minDate', day)
        dayUrl.searchParams.set('maxDate', day)
        dayUrl.searchParams.set('max', '100')

        const dayRes = await fetch(dayUrl.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        })

        const dayData = await dayRes.json()
        if (!dayRes.ok) {
          console.error('❌ Failed fetching appointments for', day, dayData)
          continue
        }

        if (Array.isArray(dayData)) allData.push(...dayData)
      }

      console.log(`🗓️ Fetched appointments for ${requestedMonth} ${requestedYear}:`, allData.length)
    } else {
      const baseUrl = new URL(`https://acuityscheduling.com/api/v1/${endpoint}`)
      baseUrl.searchParams.set('max', '100')
      const pageRes = await fetch(baseUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const pageData = await pageRes.json()
      if (!pageRes.ok) {
        console.error('❌ Failed to fetch from Acuity:', pageData)
        return NextResponse.json({ error: 'Failed to fetch from Acuity', details: pageData }, { status: 500 })
      }
      if (Array.isArray(pageData)) allData.push(...pageData)
    }
  } catch (err) {
    console.error('❌ Error fetching Acuity data:', err)
    return NextResponse.json({ error: 'Failed to fetch data', details: String(err) }, { status: 500 })
  }

  const acuityData = allData
  console.log('💧 Total fetched:', acuityData.length)


  // 6️⃣ Process appointments
  if (endpoint === 'appointments' && Array.isArray(acuityData)) {
    const appointmentsToProcess = acuityData

    // --- Group by month and day (using safe parsing)
    const groupedByMonth: Record<string, any[]> = {}
    const groupedByDay: Record<string, any[]> = {}

    for (const appt of appointmentsToProcess) {
      const parsed = parseDateStringSafe(appt.datetime)
      if (!parsed) {
        console.warn('⚠️ Could not parse datetime for appointment, falling back to Date:', appt.datetime)
        // fallback to Date if needed
        const fallback = new Date(appt.datetime)
        const monthName = MONTHS[fallback.getMonth()]
        const year = fallback.getFullYear()
        const dayKey = fallback.toISOString().split('T')[0]
        const monthKey = `${year}||${monthName}`
        if (!groupedByMonth[monthKey]) groupedByMonth[monthKey] = []
        groupedByMonth[monthKey].push(appt)

        if (!groupedByDay[dayKey]) groupedByDay[dayKey] = []
        groupedByDay[dayKey].push(appt)
        continue
      }

      const { year, monthName, dayKey } = { year: parsed.year, monthName: parsed.monthName, dayKey: parsed.dayKey }

      // debug log so you can see parsed dates
      console.log('Parsed date →', appt.datetime, '→', dayKey, monthName, year)

      const monthKey = `${year}||${monthName}`
      if (!groupedByMonth[monthKey]) groupedByMonth[monthKey] = []
      groupedByMonth[monthKey].push(appt)

      if (!groupedByDay[dayKey]) groupedByDay[dayKey] = []
      groupedByDay[dayKey].push(appt)
    }

    // --- Monthly revenue & appointments
    const revenueByMonth: Record<string, number> = {}
    const numAppointmentsByMonth: Record<string, number> = {}

    for (const [key, appts] of Object.entries(groupedByMonth)) {
      const totalRevenue = appts.reduce((sum, a) => sum + parseFloat(a.priceSold || '0'), 0)
      revenueByMonth[key] = totalRevenue
      numAppointmentsByMonth[key] = appts.length
    }

    const monthlyUpserts = Object.keys(revenueByMonth).map(key => {
      const [yearStr, month] = key.split('||')
      return {
        user_id: user.id,
        month,
        year: parseInt(yearStr),
        total_revenue: revenueByMonth[key],
        num_appointments: numAppointmentsByMonth[key],
        updated_at: new Date().toISOString(),
      }
    })

    await supabase.from('monthly_data').upsert(monthlyUpserts, { onConflict: 'user_id,month,year' })

    // --- Daily upserts (ADDITIVE): select existing row, then update totals (don't overwrite)
    for (const [day, appts] of Object.entries(groupedByDay)) {
      const totalRevenue = appts.reduce((sum, a) => sum + parseFloat(a.priceSold || '0'), 0)
      const numAppointments = appts.length

      // Use safe parsing to get month/year from 'day' (YYYY-MM-DD)
      const [y, m] = day.split('-').map(Number)
      const month = MONTHS[m - 1]
      const year = y

      // Debug parse
      console.log('Parsed dayKey →', day, 'month/year →', month, year)

      // fetch existing daily row
      const { data: existingRows, error: selectErr } = await supabase
        .from('daily_data')
        .select('id, total_revenue, num_appointments')
        .eq('user_id', user.id)
        .eq('date', day)
        .maybeSingle()

      if (selectErr) {
        console.error('❌ Error selecting existing daily row:', selectErr)
        // attempt to insert as fallback
        const { data: insertData, error: insertErr } = await supabase.from('daily_data').insert([{
          user_id: user.id,
          date: day,
          total_revenue: totalRevenue,
          num_appointments: numAppointments,
          month,
          year,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        if (insertErr) console.error('❌ Error inserting fallback daily row:', insertErr)
        else console.log('🆕 Inserted daily_data (fallback):', insertData)
        continue
      }

        if (existingRows && existingRows.id) {
          // Overwrite existing values with fresh daily totals (not additive)
          const { data: updData, error: updErr } = await supabase
            .from('daily_data')
            .update({
              total_revenue: totalRevenue,
              num_appointments: numAppointments,
              month,
              year,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingRows.id)

          if (updErr) console.error('❌ Error updating daily_data:', updErr)
          else console.log(`✅ Replaced daily_data for ${day}: revenue=${totalRevenue}, appts=${numAppointments}`)
        }
        else {
        // Insert new
        const { data: insData, error: insErr } = await supabase.from('daily_data').insert([{
          user_id: user.id,
          date: day,
          total_revenue: totalRevenue,
          num_appointments: numAppointments,
          month,
          year,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])

        if (insErr) console.error('❌ Error inserting daily data:', insErr)
        else console.log(`🆕 Inserted daily_data for ${day}:`, insData)
      }
    }

    // --- Service bookings (monthly top 5 + other)
    const serviceCounts: Record<string, { month: string; year: number; count: number }> = {}
    for (const appt of appointmentsToProcess) {
      const parsed = parseDateStringSafe(appt.datetime)
      let monthName = 'Unknown'
      let year = new Date().getFullYear()
      if (parsed) {
        monthName = parsed.monthName
        year = parsed.year
      } else {
        const fallback = new Date(appt.datetime)
        monthName = MONTHS[fallback.getMonth()]
        year = fallback.getFullYear()
      }

      const service = appt.type || 'Unknown'
      const key = `${service}||${monthName}||${year}`
      if (!serviceCounts[key]) serviceCounts[key] = { month: monthName, year, count: 0 }
      serviceCounts[key].count++
    }

    // Group services by month/year before limiting to top 5
    const monthYearMap: Record<string, Record<string, number>> = {}
    for (const [key, val] of Object.entries(serviceCounts)) {
      const [service, month, year] = key.split('||')
      const combo = `${month}||${year}`
      if (!monthYearMap[combo]) monthYearMap[combo] = {}
      monthYearMap[combo][service] = val.count
    }

    const finalUpserts: any[] = []
    for (const [combo, services] of Object.entries(monthYearMap)) {
      const [month, yearStr] = combo.split('||')
      const year = parseInt(yearStr)
      const sorted = Object.entries(services).sort((a, b) => b[1] - a[1])
      const top5 = sorted.slice(0, 5)
      const others = sorted.slice(5)

      let otherCount = 0
      for (const [, count] of others) otherCount += count

      for (const [service, count] of top5) {
        finalUpserts.push({
          user_id: user.id,
          service_name: service,
          bookings: count,
          report_month: month,
          report_year: year,
          created_at: new Date().toISOString(),
        })
      }

      if (otherCount > 0) {
        finalUpserts.push({
          user_id: user.id,
          service_name: 'Other',
          bookings: otherCount,
          report_month: month,
          report_year: year,
          created_at: new Date().toISOString(),
        })
      }
    }

    await supabase.from('service_bookings').upsert(finalUpserts, {
      onConflict: 'user_id,service_name,report_month,report_year',
    })

    // --- Top clients & marketing funnels ---
    const monthlyClientMap: Record<string, Record<string, any>> = {}

    for (const appt of appointmentsToProcess) {
      const parsed = parseDateStringSafe(appt.datetime)
      let monthName = 'Unknown'
      let year = new Date().getFullYear()
      if (parsed) {
        monthName = parsed.monthName
        year = parsed.year
      } else {
        const fallback = new Date(appt.datetime)
        monthName = MONTHS[fallback.getMonth()]
        year = fallback.getFullYear()
      }

      const key = `${year}||${monthName}`

      const name = appt.firstName && appt.lastName ? `${appt.firstName} ${appt.lastName}` : 'Unknown'
      const email = appt.email?.toLowerCase().trim() || null
      const phone = appt.phone?.replace(/\D/g, '') || null

      const clientKeySource = `${email || ''}|${phone || ''}|${name.toLowerCase()}`
      const clientKey = crypto.createHash('md5').update(clientKeySource).digest('hex')

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
          year,
        }
      }

      monthlyClientMap[key][clientKey].total_paid += parseFloat(appt.priceSold || '0')
      monthlyClientMap[key][clientKey].num_visits += 1
    }

    for (const [key, clients] of Object.entries(monthlyClientMap)) {
      const upsertClients = Object.values(clients).map(c => ({
        user_id: user.id,
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

      // --- Marketing funnels
      const referralKeywords = ['referral', 'referred', 'hear', 'heard', 'source', 'social', 'instagram', 'facebook', 'tiktok'];
      const funnelMap: Record<string, Record<string, any>> = {}

      for (const appt of appointmentsToProcess) {
        // parse date safely
        const parsed = parseDateStringSafe(appt.datetime)
        let monthName = 'Unknown'
        let year = new Date().getFullYear()
        if (parsed) {
          monthName = parsed.monthName
          year = parsed.year
        } else {
          const fallback = new Date(appt.datetime)
          monthName = MONTHS[fallback.getMonth()]
          year = fallback.getFullYear()
        }

        const key = `${monthName}||${year}`

        if (!appt.forms || !Array.isArray(appt.forms)) continue

        for (const form of appt.forms) {
          if (!form.values || !Array.isArray(form.values)) continue

          let foundReferral = false

          for (const field of form.values) {
            const fieldName = field.name?.toLowerCase() || ''
            if (referralKeywords.some(k => fieldName.includes(k))) {
              const rawValue = (field.value || '').trim()
              if (!rawValue) continue

              // 🚫 Skip if contains multiple comma-separated values
              if (rawValue.includes(',')) {
                console.log(`Skipping multi-response value: "${rawValue}"`)
                continue
              }

              const source = rawValue || 'Unknown'
              console.log(`source: ${source}`)

              if (!funnelMap[key]) funnelMap[key] = {}
              if (!funnelMap[key][source]) {
                funnelMap[key][source] = { newClients: 0, returningClients: 0, totalRevenue: 0, totalVisits: 0 }
              }

              // Estimate new vs returning
              const isReturning = appointmentsToProcess.some(
                (other) =>
                  other.email === appt.email &&
                  (() => {
                    const pOther = parseDateStringSafe(other.datetime)
                    const pThis = parseDateStringSafe(appt.datetime)
                    if (pOther && pThis) return pOther.dayKey < pThis.dayKey
                    return new Date(other.datetime) < new Date(appt.datetime)
                  })()
              )

              if (isReturning) funnelMap[key][source].returningClients++
              else funnelMap[key][source].newClients++

              funnelMap[key][source].totalRevenue += parseFloat(appt.priceSold || '0')
              funnelMap[key][source].totalVisits++

              foundReferral = true
              break // ✅ stop after first valid referral field
            }
          }

          if (foundReferral) break // ✅ stop after first valid form per appointment
        }
      }

      const funnelUpserts = Object.entries(funnelMap).flatMap(([key, sources]) => {
        const [month, yearStr] = key.split('||')
        const report_year = parseInt(yearStr)
        return Object.entries(sources).map(([source, stats]) => ({
          user_id: user.id,
          source,
          new_clients: stats.newClients,
          returning_clients: stats.returningClients,
          retention:
            stats.newClients + stats.returningClients > 0
              ? (stats.returningClients / (stats.newClients + stats.returningClients)) * 100
              : 0,
          avg_ticket: stats.totalVisits > 0 ? stats.totalRevenue / stats.totalVisits : 0,
          report_month: month,
          report_year,
          created_at: new Date().toISOString(),
        }))
      })

      if (funnelUpserts.length > 0) {
        await supabase.from('marketing_funnels').upsert(funnelUpserts, {
          onConflict: 'user_id,source,report_month,report_year',
        })
      }
    }
  }

  return NextResponse.json({
    endpoint,
    fetched_at: new Date().toISOString(),
    acuity_data: acuityData,
  })
}
