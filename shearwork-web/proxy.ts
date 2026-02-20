import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { isTrialActive } from '@/utils/trial'

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
    '/heroImages',
    '/book',
    '/privacy-policy',
    '/support'
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
    .select('role, stripe_subscription_status, cancel_at_period_end, onboarded, trial_active, trial_start, trial_end')
    .eq('user_id', user.id)
    .maybeSingle()

  const role = profile?.role?.toLowerCase()
  const subStatus = profile?.stripe_subscription_status
  const hasTrialAccess = isTrialActive(profile)

  // -----------------------------
  // ONBOARDING CHECK
  // -----------------------------
  // Non-onboarded users must complete onboarding before accessing the app
  if (profile && !profile.onboarded && role !== 'admin') {
    // Allow access to onboarding flow and related API routes
    const allowedDuringOnboarding = [
      '/pricing/return',
      '/api/onboarding',
      '/api/acuity',
      '/api/square',
    ]
    
    if (!allowedDuringOnboarding.some(route => pathname.startsWith(route))) {
      return NextResponse.redirect(new URL('/pricing/return', request.url))
    }
  }

  // -----------------------------
  // ACTIVE/TRIAL REDIRECTS
  // -----------------------------


  // -----------------------------
  // PREMIUM ACCESS
  // -----------------------------

  const hasPremiumAccess = subStatus === 'active' || hasTrialAccess

  if (subStatus === 'active' || hasTrialAccess) {
    if (pathname === '/pricing') {
      console.log('User has active subscription or trial, redirecting to dashboard')
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    if (pathname === '/pricing/return') {
      return NextResponse.next()
    }
  }

  const premiumRoutes = [
    '/dashboard',
    '/account',
    '/premium',
    '/user-editor',
    '/expenses'
  ]

  if (
    role !== 'admin' &&
    role !== 'owner' &&
    premiumRoutes.some(path => pathname.startsWith(path))
  ) {
    if (!hasPremiumAccess) {
      console.log('User does not have premium access, redirecting to pricing')  
      return NextResponse.redirect(new URL('/pricing', request.url))
    }
  }

  // -----------------------------
  // ROLE-BASED ROUTING
  // -----------------------------
  if (
    (role === 'admin') &&
    (pathname === '/' || pathname === '/dashboard')
  ) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url))
  }

  if (role !== 'admin' && pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
  ]
}