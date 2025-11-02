// app/api/acuity/pull/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user)
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  // 1️⃣ Parse requested endpoint from query (default to appointments)
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get('endpoint') || 'appointments'

  // 2️⃣ Fetch token from DB
  const { data: tokenRow, error: tokenError } = await supabase
    .from('acuity_tokens')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (tokenError || !tokenRow)
    return NextResponse.json({ error: 'No Acuity connection found' }, { status: 400 })

  // 3️⃣ Auto-refresh token if expired
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
        return NextResponse.json({ error: 'Token refresh failed', details: newTokens })
      }
    } catch (err) {
      return NextResponse.json({ error: 'Failed to refresh token', details: String(err) })
    }
  }

  // 4️⃣ Define a list of allowed Acuity endpoints (for safety)
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

  // 5️⃣ Fetch from Acuity API
  const acuityRes = await fetch(`https://acuityscheduling.com/api/v1/${endpoint}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const acuityData = await acuityRes.json()

  // TEMP: log for debugging
  console.log('💧 Acuity data fetched for endpoint', endpoint, acuityData)

  if (!acuityRes.ok) {
    return NextResponse.json({
      error: 'Failed to fetch from Acuity',
      details: acuityData,
    }, { status: 500 })
  }

  // 6️⃣ Optional: Process or store data in Supabase here
  // e.g. store new appointments into `monthly_data` or other analytics tables

  return NextResponse.json({
    endpoint,
    fetched_at: new Date().toISOString(),
    data: acuityData,
  })
}
