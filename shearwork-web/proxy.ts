import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export default async function middleware(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Public routes (for anyone)
  const publicRoutes = ['/login', '/signup', '/_next', '/api', '/pricing']

  // Handle unauthenticated users
  if (!user) {
    if (pathname === '/' || publicRoutes.some(path => pathname.startsWith(path))) {
      return NextResponse.next()
    }

    return NextResponse.redirect(new URL('/', request.url))
  }

  // User is authenticated, fetch profile (NOW INCLUDE subscription_status)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, stripe_subscription_status')
    .eq('user_id', user.id)
    .maybeSingle()

  const role = profile?.role?.toLowerCase()
  const subStatus = profile?.stripe_subscription_status

  // --------------------------------------
  // PREMIUM ACCESS CHECK
  // --------------------------------------
  const premiumRoutes = ['/dashboard', '/account', '/premium', 'user-editor', 'expenses']

  // If user is not admin/owner AND not subscribed → block premium routes
  if (
    role !== 'admin' &&
    role !== 'owner' &&
    premiumRoutes.some(path => pathname.startsWith(path))
  ) {
    if (subStatus !== 'active') {
      return NextResponse.redirect(new URL('/pricing', request.url))
    }
  }

  // --------------------------------------
  // ORIGINAL ROLE-BASED REDIRECT LOGIC
  // --------------------------------------
  if ((role === 'admin' || role === 'owner') &&
      (pathname === '/' || pathname === '/dashboard')) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url))
  }

  if (role !== 'admin' && role !== 'owner' && pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}
