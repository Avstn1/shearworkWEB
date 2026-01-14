import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/utils/api-auth'

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

    if (!user || !supabase) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date'); // Expected format: YYYY-MM-DD

    // Default to today if no date provided
    const today = new Date();
    const defaultDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const selectedDate = dateParam || defaultDate;

    // Build query for appointments on the selected date
    const query = supabase
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
        tip,
        service_type
      `)
      .eq('user_id', user.id)
      .eq('appointment_date', selectedDate)
      .order('datetime', { ascending: false }); // Latest first

    const { data: appointments, error } = await query;

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
      service_type: appt.service_type || null,
      client_first_name: clientMap[appt.client_id]?.first_name || null,
      client_last_name: clientMap[appt.client_id]?.last_name || null,
    }));

    return NextResponse.json({
      appointments: transformedAppointments,
      total: transformedAppointments.length,
      date: selectedDate,
    });
  } catch (err: any) {
    console.error('Appointments GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

    if (!user || !supabase) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
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