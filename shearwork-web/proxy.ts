import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export default async function middleware(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // -----------------------------
  // SPECIAL CASE: Mobile App Authentication Passthrough
  // -----------------------------
  // Routes that can bypass auth when they have a 'code' query parameter
  const codePassthroughRoutes = ['/pricing']
  
  if (codePassthroughRoutes.includes(pathname) && request.nextUrl.searchParams.has('code')) {
    console.log(`Allowing mobile app auth code through middleware for ${pathname}`)
    return NextResponse.next()
  }

  // Public routes (anyone can access)
  const publicRoutes = ['/login', '/signup', '/_next', '/api']

  // Handle unauthenticated users
  if (!user) {
    if (pathname === '/' || publicRoutes.some(path => pathname.startsWith(path))) {
      return NextResponse.next()
    }
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