import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // -----------------------------
  // MOBILE AUTH PASSTHROUGH
  // -----------------------------
  const codePassthroughRoutes = ['/pricing', '/pricing/return', '/settings']
  if (codePassthroughRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  // -----------------------------
  // PUBLIC ROUTES
  // -----------------------------
  const publicRoutes = [
    '/login',
    '/signup',
    '/_next',
    '/api',
    '/images',
    '/heroImages'
  ]

  if (!user) {
    if (pathname === '/' || publicRoutes.some(p => pathname.startsWith(p))) {
      return NextResponse.next()
    }
    return NextResponse.redirect(new URL('/', request.url))
  }

  // -----------------------------
  // PROFILE FETCH (SERVER ONLY)
  // -----------------------------
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, stripe_subscription_status, cancel_at_period_end, onboarded')
    .eq('user_id', user.id)
    .maybeSingle()

  const role = profile?.role?.toLowerCase()
  const subStatus = profile?.stripe_subscription_status

  // -----------------------------
  // ACTIVE/TRIAL REDIRECTS
  // -----------------------------
  if (subStatus === 'active' || subStatus === 'trialing') {
    if (pathname === '/pricing') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    if (pathname === '/pricing/return') {
      return NextResponse.next()
    }
  }

  // -----------------------------
  // PREMIUM ACCESS
  // -----------------------------
  const premiumRoutes = [
    '/dashboard',
    '/account',
    '/premium',
    '/user-editor',
    '/expenses'
  ]

  const hasPremiumAccess =
    subStatus === 'active' || subStatus === 'trialing'

  if (
    role !== 'admin' &&
    role !== 'owner' &&
    premiumRoutes.some(path => pathname.startsWith(path))
  ) {
    if (!hasPremiumAccess) {
      return NextResponse.redirect(new URL('/pricing', request.url))
    }
  }

  // -----------------------------
  // ROLE-BASED ROUTING
  // -----------------------------
  if (
    (role === 'admin' || role === 'owner') &&
    (pathname === '/' || pathname === '/dashboard')
  ) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url))
  }

  if (role !== 'admin' && role !== 'owner' && pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
  ]
}
