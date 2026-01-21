import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // -----------------------------
  // SPECIAL CASE: Mobile App Authentication Passthrough
  // -----------------------------
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

  // Store profile in cookie for client-side access
  const response = NextResponse.next()
  if (profile) {
    response.cookies.set('user-profile', JSON.stringify(profile), {
      httpOnly: false, // Client needs to read this
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 // 1 hour
    })
  }

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

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}