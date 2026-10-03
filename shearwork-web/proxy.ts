import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { resolveRedirect, type RoutingProfile } from '@/lib/auth/routing'

export default async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  // /pricing/return handles Stripe returns and mobile auth codes itself
  if (pathname.startsWith('/pricing/return')) {
    return NextResponse.next()
  }

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile: RoutingProfile | null = null
  if (user) {
    const { data, error } = await supabase
      .from('profiles')
      .select('role, stripe_subscription_status, onboarded, trial_active, trial_start, trial_end')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) console.error('[proxy] profile fetch failed:', error.message)
    profile = data
  }

  const redirectTo = resolveRedirect({ pathname, search, isLoggedIn: Boolean(user), profile })
  if (redirectTo) {
    console.log(`[proxy] ${pathname} -> ${redirectTo} (user: ${user?.id ?? 'none'})`)
    return NextResponse.redirect(new URL(redirectTo, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|woff2?)$).*)'
  ]
}
