import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function proxy(request: Request) {
  const response = NextResponse.next();

  // ✅ Await the cookies before passing
  const nextCookies = await cookies(); 

  const supabase = createRouteHandlerClient({
    cookies: () => nextCookies, // now a real RequestCookies object
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    console.log('User:', user);

    const pathname = new URL(request.url).pathname;

    if (['/', '/login', '/signup'].includes(pathname)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarded')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile?.onboarded && !pathname.startsWith('/app/onboarding')) {
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ['/', '/login', '/signup', '/app/:path*', '/dashboard/:path*'],
};
