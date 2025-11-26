'use server'

import { NextResponse } from 'next/server'
// import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getAuthenticatedUser } from '@/utils/api-auth'

export async function GET(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*', // or your frontend URL
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      },
    })
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // or your frontend URL
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  }

  const { user, supabase } = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401, headers: corsHeaders });
  // const supabase = await createSupabaseServerClient()
  // const { data: { user } } = await supabase.auth.getUser()
  // if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  // Fetch Acuity token
  const { data: tokenRow } = await supabase
    .from('acuity_tokens')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!tokenRow) return NextResponse.json({ error: 'No Acuity connection found' }, { status: 400, headers: corsHeaders })

  let accessToken = tokenRow.access_token
  const nowSec = Math.floor(Date.now() / 1000)

  // Refresh token if expired
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
      } else {
        return NextResponse.json({ error: 'Token refresh failed', details: newTokens }, { status: 500, headers: corsHeaders })
      }
    } catch (err) {
      return NextResponse.json({ error: 'Failed to refresh token', details: String(err) }, { status: 500, headers: corsHeaders })
    }
  }

  // Fetch calendars
  let calendars: any[] = []
  try {
    const res = await fetch('https://acuityscheduling.com/api/v1/calendars', {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    if (!res.ok) throw new Error(`Calendars fetch failed: ${res.status}`)
    calendars = await res.json()
  } catch (err) {
    console.error('Failed to fetch calendars:', err)
    return NextResponse.json({ error: 'Failed to fetch calendars', details: String(err) }, { status: 500, headers: corsHeaders })
  }

  // Return simplified array
  const calendarList = calendars.map(c => ({ id: c.id, name: c.name }))
  return NextResponse.json({ calendars: calendarList, headers: corsHeaders })
}
