// proxy.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// 👇 Must export a named `async function proxy(request)` for Next.js 16+
export async function proxy(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Public routes
  const isPublicRoute = ['/', '/login', '/signup', '/_next', '/api'].some(path =>
    pathname.startsWith(path)
  )

  // 🧱 If not signed in and visiting a protected route → redirect to /login
  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 🧱 If signed in and trying to visit landing page → redirect to /dashboard
  if (user && pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // ✅ Otherwise continue normally
  return NextResponse.next()
}
