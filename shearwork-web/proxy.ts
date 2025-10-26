// proxy.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const runtime = 'edge' // 👈 Required for Next.js 16 proxy support

export async function proxy(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const pathname = request.nextUrl.pathname

    const isPublicRoute = ['/', '/login', '/signup', '/_next', '/api'].some(path =>
      pathname.startsWith(path)
    )

    // Redirect if not authenticated
    if (!user && !isPublicRoute) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Redirect if authenticated but on landing page
    if (user && pathname === '/') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    return NextResponse.next()
  } catch (error) {
    console.error('Proxy error:', error)
    return NextResponse.next() // Fallback to avoid crash
  }
}
