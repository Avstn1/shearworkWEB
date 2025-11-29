// app/api/acuity/authorize/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getAuthenticatedUser } from '@/utils/api-auth'

export async function GET(request: Request) {
  const { user, supabase } = await getAuthenticatedUser(request)

  if (!user) {
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_SITE_URL))
  }

  // Generate a state token for CSRF protection
  const state = crypto.randomUUID()
  
  // Detect if this is a mobile request
  const userAgent = request.headers.get('user-agent') || ''
  const isMobile = userAgent.includes('Expo')
  
  // Store both state AND user_id in the cookie
  const stateData = JSON.stringify({ 
    state, 
    user_id: user.id,
    is_mobile: isMobile
  })
  
  const cookieStore = await cookies()
  cookieStore.set('acuity_oauth_state', stateData, { 
    httpOnly: true, 
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
  })

  // Redirect to Acuity authorization page
  const params = new URLSearchParams({
    response_type: 'code',
    scope: 'api-v1',
    client_id: process.env.ACUITY_CLIENT_ID!,
    redirect_uri: process.env.ACUITY_REDIRECT_URI!,
    state,
  })

  const acuityAuthUrl = `https://acuityscheduling.com/oauth2/authorize?${params.toString()}`
  return NextResponse.redirect(acuityAuthUrl)
}