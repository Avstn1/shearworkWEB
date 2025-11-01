import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export default async function middleware(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Public routes (for anyone)
  const publicRoutes = ['/login', '/signup', '/_next', '/api']

  // Handle unauthenticated users
  if (!user) {
    // Allow public routes and landing page
    if (pathname === '/' || publicRoutes.some(path => pathname.startsWith(path))) {
      return NextResponse.next()
    }

    // Redirect all other pages to landing
    return NextResponse.redirect(new URL('/', request.url))
  }

  // User is authenticated, fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  const role = profile?.role?.toLowerCase()

  // Redirect logic for authenticated users
  if ((role === 'admin' || role === 'owner') && (pathname === '/' || pathname === '/dashboard')) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url))
  }

  if (role !== 'admin' && role !== 'owner' && pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}
