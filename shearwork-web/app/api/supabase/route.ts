import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabaseClient';

export async function GET(req: Request) {
  try {
    // Get currently logged-in user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    // If no user is logged in, return empty array
    if (userError || !user) {
      return NextResponse.json({ data: [] });
    }

    // Fetch only this user's appointments
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
