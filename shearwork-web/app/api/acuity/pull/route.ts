import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  }

  // 1️⃣ Parse requested endpoint from query (default to appointments)
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get('endpoint') || 'appointments'

  // 2️⃣ Fetch token from DB
  const { data: tokenRow, error: tokenError } = await supabase
    .from('acuity_tokens')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (tokenError || !tokenRow) {
    return NextResponse.json(
      { error: 'No Acuity connection found' },
      { status: 400 }
    )
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
        return NextResponse.json(
          { error: 'Token refresh failed', details: newTokens },
          { status: 500 }
        )
      }
    } catch (err) {
      return NextResponse.json({
        error: 'Failed to refresh token',
        details: String(err),
      })
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
    return NextResponse.json(
      { error: `Invalid endpoint '${endpoint}'` },
      { status: 400 }
    )
  }

  // 5️⃣ Fetch data from Acuity
  const acuityRes = await fetch(`https://acuityscheduling.com/api/v1/${endpoint}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const acuityData = await acuityRes.json()

  if (!acuityRes.ok) {
    console.error('❌ Failed to fetch from Acuity:', acuityData)
    return NextResponse.json(
      { error: 'Failed to fetch from Acuity', details: acuityData },
      { status: 500 }
    )
  }

  console.log('💧 Acuity data fetched for endpoint:', endpoint)

  // 6️⃣ If appointments, calculate revenue & average ticket
  let revenueByMonth: Record<string, number> = {}
  let avgTicketByMonth: Record<string, number> = {}

  if (endpoint === 'appointments' && Array.isArray(acuityData)) {
    const paidAppointments = acuityData.filter((a: any) => a.paid === 'yes')

    const groupedByMonth: Record<string, any[]> = {}

    // group appointments by month
    for (const appt of paidAppointments) {
      const date = new Date(appt.datetime)
      const monthName = date.toLocaleString('default', { month: 'long' })
      const year = date.getFullYear()
      const key = `${year}-${monthName}`
      if (!groupedByMonth[key]) groupedByMonth[key] = []
      groupedByMonth[key].push(appt)
    }

    // calculate totals
    for (const [key, appts] of Object.entries(groupedByMonth)) {
      const totalRevenue = appts.reduce((sum, a) => sum + parseFloat(a.priceSold || '0'), 0)
      const avgTicket = appts.length > 0 ? totalRevenue / appts.length : 0

      const [year, month] = key.split('-')
      revenueByMonth[key] = totalRevenue
      avgTicketByMonth[key] = parseFloat(avgTicket.toFixed(2))
    }

    console.log('📊 Calculated revenueByMonth:', revenueByMonth)
    console.log('🎟️ Calculated avgTicketByMonth:', avgTicketByMonth)

    // 🧠 Upsert into monthly_data
    const upsertRows = Object.keys(revenueByMonth).map((key) => {
      const [year, month] = key.split('-')
      return {
        user_id: user.id,
        month,
        year: parseInt(year),
        total_revenue: revenueByMonth[key],
        avg_ticket: avgTicketByMonth[key],
        updated_at: new Date().toISOString(),
      }
    })

    const { error: upsertError } = await supabase.from('monthly_data').upsert(upsertRows, {
      onConflict: 'user_id,month,year',
    })

    if (upsertError) {
      console.error('❌ Failed to update monthly_data:', upsertError)
    } else {
      console.log('✅ monthly_data table updated successfully!')
    }
  }

  // 7️⃣ Return summary
  return NextResponse.json({
    endpoint,
    fetched_at: new Date().toISOString(),
    updated_rows: Object.keys(revenueByMonth).length,
    revenue_summary: revenueByMonth,
    avg_ticket_summary: avgTicketByMonth,
  })
}
