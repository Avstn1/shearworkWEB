import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({
      cookies: () => Promise.resolve(cookies()),
    });

    // Get the currently logged-in user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ data: [] });
    }

    // Fetch this user's appointments
    const { data, error } = await supabase
      .from('barber_data')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (error) {
      return NextResponse.json({ data: [] });
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ data: [] });
  }
}
