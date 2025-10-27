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

  const isPublicRoute = ['/', '/login', '/signup', '/_next', '/api'].some(path =>
    pathname.startsWith(path)
  )

  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (user) {
    // Fetch profile to check role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    const role = profile?.role?.toLowerCase()

    // Admins always go to /admin/dashboard
    if (role === 'admin' || role === 'owner') {
      if (pathname === '/' || pathname === '/dashboard') {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url))
      }
    } else {
      // Normal users default
      if (pathname === '/') {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
  }

  return response
}
