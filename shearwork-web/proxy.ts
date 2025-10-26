import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function proxy(request: Request) {
  const response = NextResponse.next();

  const supabase = createRouteHandlerClient({
    cookies: () => Promise.resolve(cookies()),
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    console.log('User:', user);

    // Redirect logged-in users away from auth pages
    if (['/', '/login', '/signup'].includes(new URL(request.url).pathname)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Fetch profile safely
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarded')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile?.onboarded && !new URL(request.url).pathname.startsWith('/app/onboarding')) {
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ['/', '/login', '/signup', '/app/:path*', '/dashboard/:path*'],
};
