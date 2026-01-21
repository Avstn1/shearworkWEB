import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // -----------------------------
  // SPECIAL CASE: Mobile App Authentication Passthrough
  // -----------------------------
  // Routes that can bypass auth when they have a 'code' query parameter
  const codePassthroughRoutes = ['/pricing', '/pricing/return', '/settings']
  
  if (codePassthroughRoutes.some(route => pathname.startsWith(route))) {
    console.log(`Allowing access to ${pathname}`)
    return NextResponse.next()
  }

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Public routes (anyone can access)
  const publicRoutes = ['/login', '/signup', '/_next', '/api', '/images', '/heroImages']

  // Handle unauthenticated users
  if (!user) {
    // console.log('User not authenticated. Running public route check for path:', pathname)
    if (pathname === '/' || publicRoutes.some(path => pathname.startsWith(path))) {
      return NextResponse.next()
    }
    console.log('User not authenticated. Redirecting to home from path:', pathname)
    return NextResponse.redirect(new URL('/', request.url))
  }

  // User is authenticated, fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, stripe_subscription_status, cancel_at_period_end')
    .eq('user_id', user.id)
    .maybeSingle()

  const role = profile?.role?.toLowerCase()
  const subStatus = profile?.stripe_subscription_status

  // -----------------------------
  // REDIRECT ACTIVE/TRIAL USERS FROM /PRICING
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
  // PREMIUM ACCESS CHECK
  // -----------------------------
  const premiumRoutes = ['/dashboard', '/account', '/premium', '/user-editor', '/expenses']
  const hasPremiumAccess = subStatus === 'active' || subStatus === 'trialing'

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
  // ROLE-BASED REDIRECT LOGIC
  // -----------------------------
  if ((role === 'admin' || role === 'owner') &&
      (pathname === '/' || pathname === '/dashboard')) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url))
  }

  if (role !== 'admin' && role !== 'owner' && pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}