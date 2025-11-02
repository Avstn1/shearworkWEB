import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function POST() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'User not logged in' }, { status: 401 })
  }

  // Get existing tokens
  const { data: tokenData, error } = await supabase
    .from('acuity_tokens')
    .select('refresh_token')
    .eq('user_id', user.id)
    .single()

  if (error || !tokenData?.refresh_token) {
    return NextResponse.json({ error: 'No refresh token found' }, { status: 400 })
  }

  // Call Acuity token refresh endpoint
  const refreshResponse = await fetch('https://acuityscheduling.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokenData.refresh_token,
      client_id: process.env.ACUITY_CLIENT_ID!,
      client_secret: process.env.ACUITY_CLIENT_SECRET!,
    }),
  })

  const refreshData = await refreshResponse.json()

  if (!refreshResponse.ok) {
    return NextResponse.json({ error: 'Failed to refresh token', details: refreshData }, { status: 400 })
  }

  // Calculate new expiration time
  const expiresAt = new Date(Date.now() + refreshData.expires_in * 1000).toISOString()

  // Update tokens in Supabase
  await supabase
    .from('acuity_tokens')
    .update({
      access_token: refreshData.access_token,
      refresh_token: refreshData.refresh_token ?? tokenData.refresh_token,
      token_type: refreshData.token_type,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  return NextResponse.json({ success: true, access_token: refreshData.access_token })
}
