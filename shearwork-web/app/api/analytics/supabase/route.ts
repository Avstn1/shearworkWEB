/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({
      cookies: async () => cookies(),
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.warn('No logged-in user found.');
      return NextResponse.json({ data: [] });
    }

    // Fetch user-specific barber data
    const { data, error } = await supabase
      .from('barber_data')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (error) {
      console.error('Supabase query error:', error.message);
      return NextResponse.json({ data: [] });
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Unexpected error in appointments route:', err);
    return NextResponse.json({ data: [] });
  }
}
