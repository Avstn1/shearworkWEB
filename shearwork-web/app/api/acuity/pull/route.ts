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
  end.setDate(0) // last day of month

  const today = new Date()
  if (end > today) {
    end.setFullYear(today.getFullYear(), today.getMonth(), today.getDate())
  }

  const dates: string[] = []
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
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

    // --- Group by month
    const groupedByMonth: Record<string, any[]> = {}
    for (const appt of appointmentsToProcess) {
      const date = new Date(appt.datetime)
      const monthName = MONTHS[date.getUTCMonth()]
      const year = date.getUTCFullYear()
      const key = `${year}||${monthName}`
      if (!groupedByMonth[key]) groupedByMonth[key] = []
      groupedByMonth[key].push(appt)
    }

    // --- Revenue calculations
    // --- Count number of appointments per month
    const revenueByMonth: Record<string, number> = {}
    const numAppointmentsByMonth: Record<string, number> = {}
    for (const [key, appts] of Object.entries(groupedByMonth)) {
      const totalRevenue = appts.reduce((sum, a) => sum + parseFloat(a.priceSold || '0'), 0)
      revenueByMonth[key] = totalRevenue
      numAppointmentsByMonth[key] = appts.length
    }


    // --- Upsert monthly_data with total_revenue and num_appointments
    const upsertRows = Object.keys(revenueByMonth).map(key => {
      const [year, month] = key.split('||')
      return {
        user_id: user.id,
        month,
        year: parseInt(year),
        total_revenue: revenueByMonth[key],
        num_appointments: numAppointmentsByMonth[key],
        updated_at: new Date().toISOString(),
      }
    })

    await supabase.from('monthly_data').upsert(upsertRows, { onConflict: 'user_id,month,year' })

    // --- Service bookings (Top 5 + "Other")
    const serviceCounts: Record<string, { month: string; year: number; count: number }> = {}
    for (const appt of appointmentsToProcess) {
      const service = appt.type || 'Unknown'
      const date = new Date(appt.datetime)
      const month = MONTHS[date.getUTCMonth()]
      const year = date.getUTCFullYear()
      const key = `${service}||${month}||${year}`
      if (!serviceCounts[key]) serviceCounts[key] = { month, year, count: 0 }
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

    // --- Top clients (supports clients with email, phone, or neither)
    const monthlyClientMap: Record<
      string,
      Record<
        string,
        {
          client_name: string
          email: string | null
          phone: string | null
          client_key: string
          total_paid: number
          num_visits: number
          month: string
          year: number
        }
      >
    > = {}

    for (const appt of appointmentsToProcess) {
      const date = new Date(appt.datetime)
      const month = MONTHS[date.getUTCMonth()]
      const year = date.getFullYear()
      const key = `${year}||${month}`

      const name = appt.firstName && appt.lastName ? `${appt.firstName} ${appt.lastName}` : 'Unknown'
      const email = appt.email?.toLowerCase().trim() || null
      const phone = appt.phone?.replace(/\D/g, '') || null

      // Generate deterministic fallback key
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
          month,
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
      // --- 🧭 MARKETING FUNNELS: Extract and Aggregate Referral Sources ---
      const referralKeywords = ['referral', 'referred', 'hear', 'heard', 'source', 'social', 'instagram', 'facebook', 'tiktok'];
      const funnelMap: Record<string, Record<string, { newClients: number; returningClients: number; totalRevenue: number; totalVisits: number }>> = {};

      for (const appt of appointmentsToProcess) {
        if (!appt.forms || !Array.isArray(appt.forms)) continue;

        const date = new Date(appt.datetime);
        const month = MONTHS[date.getUTCMonth()];
        const year = date.getUTCFullYear();
        const key = `${month}||${year}`;

        for (const form of appt.forms) {
          if (!form.values || !Array.isArray(form.values)) continue;

          for (const field of form.values) {
            const fieldName = field.name?.toLowerCase() || '';
            if (referralKeywords.some(k => fieldName.includes(k))) {
              const source = (field.value || 'Unknown').trim() || 'Unknown';

              if (!funnelMap[key]) funnelMap[key] = {};
              if (!funnelMap[key][source]) {
                funnelMap[key][source] = { newClients: 0, returningClients: 0, totalRevenue: 0, totalVisits: 0 };
              }

              // Estimate new vs returning
              const isReturning = appointmentsToProcess.some(
                (other) =>
                  other.email === appt.email &&
                  new Date(other.datetime) < new Date(appt.datetime)
              );

              if (isReturning) funnelMap[key][source].returningClients++;
              else funnelMap[key][source].newClients++;

              funnelMap[key][source].totalRevenue += parseFloat(appt.priceSold || '0');
              funnelMap[key][source].totalVisits++;
            }
          }
        }
      }

      // Convert aggregated funnel data to upsert format
      const funnelUpserts = Object.entries(funnelMap).flatMap(([key, sources]) => {
        const [month, yearStr] = key.split('||');
        const report_year = parseInt(yearStr);

        return Object.entries(sources).map(([source, stats]) => ({
          user_id: user.id,
          source,
          new_clients: stats.newClients,
          returning_clients: stats.returningClients,
          retention:
            stats.newClients + stats.returningClients > 0
              ? (stats.returningClients / (stats.newClients + stats.returningClients)) * 100
              : 0,
          avg_ticket:
            stats.totalVisits > 0 ? stats.totalRevenue / stats.totalVisits : 0,
          report_month: month,
          report_year,
          created_at: new Date().toISOString(),
        }));
      });

      if (funnelUpserts.length > 0) {
        console.log(`🧭 Upserting ${funnelUpserts.length} marketing funnel records...`);
        await supabase.from('marketing_funnels').upsert(funnelUpserts, {
          onConflict: 'user_id,source,report_month,report_year',
        });
      }
    }
  }

  return NextResponse.json({
    endpoint,
    fetched_at: new Date().toISOString(),
    acuity_data: acuityData,
  })
}
