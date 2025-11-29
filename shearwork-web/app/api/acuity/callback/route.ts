import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { cookies } from 'next/headers'
import { getAuthenticatedUser } from '@/utils/api-auth'

export async function GET(request: Request) {
  const { user, supabase } = await getAuthenticatedUser(request)
  const cookieStore = await cookies()
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  const savedState = cookieStore.get('acuity_oauth_state')?.value
  if (savedState !== state) {
    return NextResponse.json({ error: 'Invalid state parameter' }, { status: 400 })
  }

  if (!code) {
    return NextResponse.json({ error: 'Missing code parameter' }, { status: 400 })
  }

  // Exchange authorization code for access token
  const tokenResponse = await fetch('https://acuityscheduling.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.ACUITY_REDIRECT_URI!,
      client_id: process.env.ACUITY_CLIENT_ID!,
      client_secret: process.env.ACUITY_CLIENT_SECRET!,
    }),
  })

  const tokenData = await tokenResponse.json()

  if (!tokenResponse.ok) {
    return NextResponse.json({ error: 'Token exchange failed', details: tokenData }, { status: 400 })
  }

  if (!user) {
    return NextResponse.json({ error: 'User not logged in during callback' }, { status: 401 })
  }

  // Save tokens to Supabase
  await supabase.from('acuity_tokens').upsert({
    user_id: user.id,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    token_type: tokenData.token_type,
    expires_in: tokenData.expires_in,
    updated_at: new Date().toISOString(),
  })

  // Redirect back to app (dashboard, settings, etc.)
  return NextResponse.redirect(new URL('/dashboard', process.env.NEXT_PUBLIC_SITE_URL!))
}
