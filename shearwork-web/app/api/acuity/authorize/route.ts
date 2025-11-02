import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { cookies } from 'next/headers'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // Not logged in — redirect to login page
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_SITE_URL))
  }

  // Generate a state token for CSRF protection
  const state = crypto.randomUUID()
  const cookieStore = await cookies()
  cookieStore.set('acuity_oauth_state', state, { httpOnly: true, secure: true })

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
