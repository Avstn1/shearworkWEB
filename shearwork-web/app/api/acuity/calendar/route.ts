'use server'

import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'

export async function GET(request: Request) {
  // Handle preflight OPTIONS requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*', // replace '*' with your frontend URL
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      },
    })
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  }

  try {
    // Log all request headers
    console.log('Incoming request headers:')
    request.headers.forEach((value, key) => {
      console.log(`${key}: ${value}`)
    })

    // Authenticate user
    const { user, supabase } = await getAuthenticatedUser(request)
    console.log('Authenticated user:', user?.id)
    if (!user) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401, headers: corsHeaders })
    }

    // Fetch Acuity token from DB
    const { data: tokenRow, error: tokenError } = await supabase
      .from('acuity_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single()
    console.log('Token row:', tokenRow, 'Token error:', tokenError)
    if (!tokenRow) {
      return NextResponse.json({ error: 'No Acuity connection found' }, { status: 400, headers: corsHeaders })
    }

    let accessToken = tokenRow.access_token
    console.log('Access token from DB:', accessToken)
    const nowSec = Math.floor(Date.now() / 1000)

    // Refresh token if expired
    if (tokenRow.expires_at && tokenRow.expires_at < nowSec) {
      console.log('Token expired. Refreshing...')
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
        console.log('Refresh response:', newTokens)
        if (!refreshRes.ok) {
          return NextResponse.json({ error: 'Token refresh failed', details: newTokens }, { status: 500, headers: corsHeaders })
        }
        accessToken = newTokens.access_token
        console.log('New access token:', accessToken)
        await supabase.from('acuity_tokens').update({
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token ?? tokenRow.refresh_token,
          expires_at: nowSec + newTokens.expires_in,
          updated_at: new Date().toISOString(),
        }).eq('user_id', user.id)
      } catch (err) {
        console.error('Token refresh error:', err)
        return NextResponse.json({ error: 'Failed to refresh token', details: String(err) }, { status: 500, headers: corsHeaders })
      }
    }

    // Fetch calendars
    let calendars: any[] = []
    try {
      console.log('Fetching calendars with token:', accessToken)
      const res = await fetch('https://acuityscheduling.com/api/v1/calendars', {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      console.log('Calendars fetch status:', res.status)
      if (!res.ok) throw new Error(`Calendars fetch failed: ${res.status}`)
      calendars = await res.json()
      console.log('Calendars fetched:', calendars)
    } catch (err) {
      console.error('Failed to fetch calendars:', err)
      return NextResponse.json({ error: 'Failed to fetch calendars', details: String(err) }, { status: 500, headers: corsHeaders })
    }

    // Return simplified array with CORS headers
    const calendarList = calendars.map(c => ({ id: c.id, name: c.name }))
    return NextResponse.json({ calendars: calendarList }, { headers: corsHeaders })

  } catch (err) {
    console.error('Internal server error:', err)
    return NextResponse.json({ error: 'Internal server error', details: String(err) }, { status: 500, headers: corsHeaders })
  }
}
