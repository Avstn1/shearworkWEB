import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

type SortField = 'datetime' | 'revenue' | 'tip';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim().toLowerCase() || '';
    const sort = (searchParams.get('sort') as SortField) || 'datetime';
    const dir = searchParams.get('dir') === 'asc' ? 'asc' : 'desc';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const offset = (page - 1) * limit;

    // Get current timestamp for filtering past appointments only
    const now = new Date().toISOString();

    // If searching, first find matching client IDs by name
    let matchingClientIds: string[] = [];
    if (search) {
      const { data: matchingClients } = await supabase
        .from('acuity_clients')
        .select('client_id')
        .or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
      
      matchingClientIds = (matchingClients || []).map((c: any) => c.client_id);
    }

    // Build query for appointments that have already occurred
    // Fetching from acuity_appointments WITHOUT join (no FK relationship)
    let query = supabase
      .from('acuity_appointments')
      .select(`
        id,
        user_id,
        acuity_appointment_id,
        client_id,
        phone_normalized,
        appointment_date,
        revenue,
        datetime,
        created_at,
        tip
      `, { count: 'exact' })
      .eq('user_id', user.id)
      .lte('datetime', now); // Only past appointments

    // Search filter - search by phone number, client_id, or matching client names
    if (search) {
      if (matchingClientIds.length > 0) {
        // Search by phone, client_id, OR any of the matching client IDs from name search
        const clientIdFilters = matchingClientIds.map(id => `client_id.eq.${id}`).join(',');
        query = query.or(`phone_normalized.ilike.%${search}%,client_id.ilike.%${search}%,${clientIdFilters}`);
      } else {
        // No name matches, just search by phone and client_id
        query = query.or(`phone_normalized.ilike.%${search}%,client_id.ilike.%${search}%`);
      }
    }

    // Sorting
    query = query.order(sort, { ascending: dir === 'asc' });

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data: appointments, error, count } = await query;

    if (error) {
      console.error('Error fetching appointments:', error);
      return NextResponse.json({ error: 'Failed to fetch appointments' }, { status: 500 });
    }

    // Get unique client_ids to fetch client names
    const clientIds = [...new Set((appointments || []).map((a: any) => a.client_id).filter(Boolean))];
    
    // Fetch client names from acuity_clients
    let clientMap: Record<string, { first_name: string | null; last_name: string | null }> = {};
    
    if (clientIds.length > 0) {
      const { data: clients } = await supabase
        .from('acuity_clients')
        .select('client_id, first_name, last_name')
        .in('client_id', clientIds);
      
      if (clients) {
        clientMap = clients.reduce((acc: any, client: any) => {
          acc[client.client_id] = {
            first_name: client.first_name,
            last_name: client.last_name,
          };
          return acc;
        }, {});
      }
    }

    // Transform the data to include client names
    const transformedAppointments = (appointments || []).map((appt: any) => ({
      id: appt.id,
      acuity_appointment_id: appt.acuity_appointment_id,
      client_id: appt.client_id,
      phone_normalized: appt.phone_normalized,
      appointment_date: appt.appointment_date,
      datetime: appt.datetime,
      revenue: appt.revenue,
      tip: appt.tip,
      client_first_name: clientMap[appt.client_id]?.first_name || null,
      client_last_name: clientMap[appt.client_id]?.last_name || null,
    }));

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      appointments: transformedAppointments,
      page,
      limit,
      total,
      totalPages,
    });
  } catch (err: any) {
    console.error('Appointments GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, tip, revenue } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Build update object with provided fields
    const updateData: { tip?: number; revenue?: number } = {};

    if (tip !== undefined && tip !== null) {
      const tipValue = parseFloat(tip);
      if (isNaN(tipValue) || tipValue < 0) {
        return NextResponse.json({ error: 'tip must be a valid non-negative number' }, { status: 400 });
      }
      updateData.tip = tipValue;
    }

    if (revenue !== undefined && revenue !== null) {
      const revenueValue = parseFloat(revenue);
      if (isNaN(revenueValue) || revenueValue < 0) {
        return NextResponse.json({ error: 'revenue must be a valid non-negative number' }, { status: 400 });
      }
      updateData.revenue = revenueValue;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Update the appointment
    const { data, error } = await supabase
      .from('acuity_appointments')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id) // Ensure user owns this appointment
      .select()
      .single();

    if (error) {
      console.error('Error updating appointment:', error);
      return NextResponse.json({ error: 'Failed to update appointment' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      appointment: data,
      message: 'Appointment updated successfully' 
    });
  } catch (err: any) {
    console.error('Appointments PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}