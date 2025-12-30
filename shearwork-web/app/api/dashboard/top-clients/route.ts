import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

// Month name to number mapping
const MONTHS: Record<string, number> = {
  'January': 1, 'February': 2, 'March': 3, 'April': 4,
  'May': 5, 'June': 6, 'July': 7, 'August': 8,
  'September': 9, 'October': 10, 'November': 11, 'December': 12
};

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
    const monthNum = MONTHS[month];

    if (!monthNum) {
      return NextResponse.json({ error: 'Invalid month name' }, { status: 400 });
    }

    // Build date range for the month
    const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
    const endDate = monthNum === 12 
      ? `${year + 1}-01-01`
      : `${year}-${String(monthNum + 1).padStart(2, '0')}-01`;

    // Fetch all appointments for the user in the selected month
    const { data: appointments, error: apptError } = await supabase
      .from('acuity_appointments')
      .select('client_id, revenue, tip')
      .eq('user_id', user.id)
      .gte('appointment_date', startDate)
      .lt('appointment_date', endDate);

    if (apptError) {
      console.error('Error fetching appointments:', apptError);
      return NextResponse.json({ error: 'Failed to fetch appointments' }, { status: 500 });
    }

    // Aggregate by client_id: sum revenue + tip
    const clientTotals: Record<string, { revenue: number; tips: number; visits: number }> = {};

    for (const appt of appointments || []) {
      if (!appt.client_id) continue;

      if (!clientTotals[appt.client_id]) {
        clientTotals[appt.client_id] = { revenue: 0, tips: 0, visits: 0 };
      }

      clientTotals[appt.client_id].revenue += appt.revenue || 0;
      clientTotals[appt.client_id].tips += appt.tip || 0;
      clientTotals[appt.client_id].visits += 1;
    }

    // Get unique client IDs
    const clientIds = Object.keys(clientTotals);

    if (clientIds.length === 0) {
      return NextResponse.json({ clients: [], month, year });
    }

    // Fetch client names from acuity_clients
    const { data: clients, error: clientError } = await supabase
      .from('acuity_clients')
      .select('client_id, first_name, last_name')
      .in('client_id', clientIds);

    if (clientError) {
      console.error('Error fetching clients:', clientError);
    }

    // Build client name map
    const clientNameMap: Record<string, string> = {};
    for (const client of clients || []) {
      const name = [client.first_name, client.last_name].filter(Boolean).join(' ').trim();
      clientNameMap[client.client_id] = name || 'Unknown';
    }

    // Build result array with total_spent = revenue + tips
    const result = clientIds.map(clientId => {
      const totals = clientTotals[clientId];
      const clientName = clientNameMap[clientId] || 'Unknown';
      
      return {
        client_id: clientId,
        client_name: clientName,
        revenue: totals.revenue,
        tips: totals.tips,
        total_spent: totals.revenue + totals.tips,
        num_visits: totals.visits,
      };
    });

    // Filter out unwanted names
    const filtered = result.filter(c => 
      c.client_name &&
      c.client_name !== 'Unknown' &&
      c.client_name !== 'Returning Client' &&
      !/walk/i.test(c.client_name)
    );

    // Sort by total_spent descending and take top N
    filtered.sort((a, b) => b.total_spent - a.total_spent);
    const topClients = filtered.slice(0, limit);

    return NextResponse.json({
      clients: topClients,
      month,
      year,
    });
  } catch (err: any) {
    console.error('Top clients GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}