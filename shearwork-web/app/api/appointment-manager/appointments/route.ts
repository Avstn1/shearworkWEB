import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date'); // Expected format: YYYY-MM-DD

    // Default to today if no date provided
    const today = new Date();
    const defaultDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const selectedDate = dateParam || defaultDate;

    const { data: squareToken } = await supabase
      .from('square_tokens')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const useSquare = Boolean(squareToken?.user_id);
    const appointmentTable = useSquare ? 'square_appointments' : 'acuity_appointments';
    const appointmentIdField = useSquare ? 'square_booking_id' : 'acuity_appointment_id';
    const clientIdField = useSquare ? 'customer_id' : 'client_id';

    const selectFields = [
      'id',
      'user_id',
      appointmentIdField,
      clientIdField,
      'phone_normalized',
      'appointment_date',
      'revenue',
      'datetime',
      'created_at',
      'tip',
      'service_type',
      'notes',
      'status',
      'payment_id',
    ].join(',');

    // Build query for appointments on the selected date
    let query = supabase
      .from(appointmentTable)
      .select(selectFields)
      .eq('user_id', user.id)
      .eq('appointment_date', selectedDate)
      .order('datetime', { ascending: false }); // Latest first

    const { data: appointments, error } = await query;

    if (error) {
      console.error('Error fetching appointments:', error);
      return NextResponse.json({ error: 'Failed to fetch appointments' }, { status: 500 });
    }

    const rawAppointments = appointments || [];
    const clientIds = [...new Set(rawAppointments.map((appt: any) => appt[clientIdField]).filter(Boolean))];

    let clientMap: Record<string, { first_name: string | null; last_name: string | null }> = {};

    if (clientIds.length > 0) {
      const clientTable = useSquare ? 'square_clients' : 'acuity_clients';
      const clientIdColumn = useSquare ? 'customer_id' : 'client_id';

      const { data: clients } = await supabase
        .from(clientTable)
        .select(`${clientIdColumn}, first_name, last_name`)
        .in(clientIdColumn, clientIds);

      if (clients) {
        clientMap = clients.reduce((acc: any, client: any) => {
          const key = client[clientIdColumn];
          acc[key] = {
            first_name: client.first_name,
            last_name: client.last_name,
          };
          return acc;
        }, {});
      }
    }

    const transformedAppointments = rawAppointments.map((appt: any) => {
      const clientId = appt[clientIdField];
      const appointmentId = appt[appointmentIdField];

      return {
        id: appt.id,
        acuity_appointment_id: appointmentId,
        client_id: clientId,
        phone_normalized: appt.phone_normalized,
        appointment_date: appt.appointment_date,
        datetime: appt.datetime,
        revenue: appt.revenue,
        tip: appt.tip,
        service_type: appt.service_type || null,
        client_first_name: clientMap[clientId]?.first_name || null,
        client_last_name: clientMap[clientId]?.last_name || null,
      };
    });

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

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, tip, revenue } = body;

    const { data: squareToken } = await supabase
      .from('square_tokens')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const useSquare = Boolean(squareToken?.user_id);
    const appointmentTable = useSquare ? 'square_appointments' : 'acuity_appointments';

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Build update object with provided fields
    const updateData: { tip?: number; revenue?: number; manually_edited?: boolean; updated_at?: string } = {
      manually_edited: true,
      updated_at: new Date().toISOString(),
    };

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
      .from(appointmentTable)
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