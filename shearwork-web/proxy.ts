import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export default async function proxy(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  const isPublicRoute = [
    '/login',
    '/signup',
    '/_next',
    '/api',
  ].some((path) => pathname.startsWith(path))

  // If not signed in → send to login
  if (!user && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // If signed in and tries to access "/" → send to dashboard
  if (user && pathname === '/') {
    const dashUrl = new URL('/dashboard', request.url)
    return NextResponse.redirect(dashUrl)
  }

  return response
}
