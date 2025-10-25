import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function proxy(request: NextRequest) {
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // ✅ Redirect logged-in users from /login to /dashboard
    if (['/', '/login', '/signup'].includes(request.nextUrl.pathname)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarded')
      .eq('user_id', user.id)
      .single();

    if (profile && !profile.onboarded && !request.nextUrl.pathname.startsWith('/app/onboarding')) {
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }
  }

  return response;
}

// ✅ Apply middleware only to protected routes + login page
export const config = {
  matcher: ['/', '/login', '/signup', '/app/:path*', '/dashboard/:path*'],
};
