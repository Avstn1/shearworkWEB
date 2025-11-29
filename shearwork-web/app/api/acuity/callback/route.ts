// app/api/acuity/callback/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const cookieStore = await cookies()
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  const savedStateRaw = cookieStore.get('acuity_oauth_state')?.value
  
  if (!savedStateRaw) {
    return NextResponse.json({ error: 'Missing state cookie' }, { status: 400 })
  }

  // Parse the state data to get both state and user_id
  let savedStateData
  try {
    savedStateData = JSON.parse(savedStateRaw)
  } catch (err) {
    return NextResponse.json({ error: 'Invalid state cookie format' }, { status: 400 })
  }

  // Compare the state value
  if (savedStateData.state !== state) {
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

  // Get user_id from the cookie
  const userId = savedStateData.user_id
  
  if (!userId) {
    return NextResponse.json({ error: 'User ID not found in state' }, { status: 401 })
  }

  // Save tokens to Supabase
  await supabase.from('acuity_tokens').upsert({
    user_id: userId,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    token_type: tokenData.token_type,
    expires_in: tokenData.expires_in,
    updated_at: new Date().toISOString(),
  })

  cookieStore.delete('acuity_oauth_state')

  const isMobile = savedStateData.is_mobile

  if (isMobile) {
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="oauth-status" content="success">
          <title>Success</title>
        </head>
        <body>
          <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; flex-direction: column;">
            <h1 style="color: #8bcf68;">✓ Connected Successfully</h1>
            <p>You can close this window and return to the app.</p>
          </div>
        </body>
      </html>
      `,
      {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
        },
      }
    )
  } else {
    return NextResponse.redirect(new URL('/dashboard', process.env.NEXT_PUBLIC_SITE_URL!))
  }
}