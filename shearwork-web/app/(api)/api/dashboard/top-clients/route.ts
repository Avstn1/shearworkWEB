import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // e.g., "December"
    const yearParam = searchParams.get('year');
    const limit = parseInt(searchParams.get('limit') || '5', 10);

    if (!month || !yearParam) {
      return NextResponse.json({ error: 'month and year are required' }, { status: 400 });
    }

    const year = parseInt(yearParam, 10);

    if (!MONTHS.includes(month)) {
      return NextResponse.json({ error: 'Invalid month name' }, { status: 400 });
    }

    const { data: rows, error } = await supabase
      .from('report_top_clients')
      .select('client_id, client_name, total_paid, num_visits')
      .eq('user_id', user.id)
      .eq('month', month)
      .eq('year', year)
      .order('total_paid', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching top clients:', error);
      return NextResponse.json({ error: 'Failed to fetch top clients' }, { status: 500 });
    }

    const clients = (rows || []).map((row) => ({
      client_id: row.client_id,
      client_name: row.client_name || 'Unknown',
      revenue: Number(row.total_paid || 0),
      tips: 0,
      total_spent: Number(row.total_paid || 0),
      num_visits: Number(row.num_visits || 0),
    }));

    return NextResponse.json({
      clients,
      month,
      year,
    });
  } catch (err: unknown) {
    console.error('Top clients GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
