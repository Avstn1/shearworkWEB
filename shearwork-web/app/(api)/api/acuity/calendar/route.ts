/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'

export async function GET(request: Request) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

    const { data: tokenRow, error: tokenError } = await supabase
      .rpc('get_acuity_token', { p_user_id: user.id })
      .single()

    if (!tokenRow) return NextResponse.json({ error: 'No Acuity connection found' }, { status: 400 })
    
    const token = tokenRow as any
    let accessToken = token.access_token
    const nowSec = Math.floor(Date.now() / 1000)

    if (token.expires_at && token.expires_at < nowSec) {
      const refreshRes = await fetch('https://acuityscheduling.com/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: token.refresh_token,
          client_id: process.env.ACUITY_CLIENT_ID!,
          client_secret: process.env.ACUITY_CLIENT_SECRET!,
        }),
      })
      const newTokens = await refreshRes.json()
      if (!refreshRes.ok) return NextResponse.json({ error: 'Token refresh failed', details: newTokens }, { status: 500 })
      accessToken = newTokens.access_token
      await supabase.from('acuity_tokens').update({
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token ?? token.refresh_token,
        expires_at: nowSec + newTokens.expires_in,
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id)
    }

    const res = await fetch('https://acuityscheduling.com/api/v1/calendars', {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    if (!res.ok) throw new Error(`Calendars fetch failed: ${res.status}`)
    const calendars = await res.json()
    const calendarList = calendars.map((c: any) => ({ id: c.id, name: c.name }))

    return NextResponse.json({ calendars: calendarList })
  } catch (err) {
    console.error('Internal server error:', err)
    return NextResponse.json({ error: 'Internal server error', details: String(err) }, { status: 500 })
  }
}