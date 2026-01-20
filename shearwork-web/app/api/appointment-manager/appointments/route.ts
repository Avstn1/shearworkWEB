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

<<<<<<< HEAD
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
=======
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

    const query = supabase
      .from(appointmentTable)
      .select(selectFields)
>>>>>>> 0194bbc25a9917ec0c1dc473269c0f6970935b90
      .eq('user_id', user.id)
      .eq('appointment_date', selectedDate)
      .order('datetime', { ascending: false }); // Latest first

    const { data: appointments, error } = await query;

    if (error) {
      console.error('Error fetching appointments:', error);
      return NextResponse.json({ error: 'Failed to fetch appointments' }, { status: 500 });
    }

    type RawAppointment = {
      id: string;
      appointment_date: string;
      datetime: string;
      revenue: number | null;
      tip: number | null;
      service_type?: string | null;
      phone_normalized?: string | null;
      [key: string]: unknown;
    };

    type RawClientRow = {
      first_name: string | null;
      last_name: string | null;
      [key: string]: unknown;
    };

    const toStringValue = (value: unknown) =>
      typeof value === 'string' && value.trim() ? value : null;

    const rawAppointments = (appointments || []) as unknown as RawAppointment[];
    const clientIds = [...new Set(
      rawAppointments
        .map((appt) => toStringValue(appt[clientIdField]))
        .filter((id): id is string => Boolean(id))
    )];

    let clientMap: Record<string, { first_name: string | null; last_name: string | null }> = {};

    if (clientIds.length > 0) {
      const clientTable = useSquare ? 'square_clients' : 'acuity_clients';
      const clientIdColumn = useSquare ? 'customer_id' : 'client_id';

      const { data: clients } = await supabase
        .from(clientTable)
        .select(`${clientIdColumn}, first_name, last_name`)
        .in(clientIdColumn, clientIds);

      if (clients) {
        clientMap = (clients as RawClientRow[]).reduce((acc, client) => {
          const key = toStringValue(client[clientIdColumn]);
          if (!key) return acc;
          acc[key] = {
            first_name: client.first_name ?? null,
            last_name: client.last_name ?? null,
          };
          return acc;
        }, {} as Record<string, { first_name: string | null; last_name: string | null }>);
      }
    }

    const transformedAppointments = rawAppointments.map((appt) => {
      const clientId = toStringValue(appt[clientIdField]);
      const appointmentId = toStringValue(appt[appointmentIdField]);

      return {
        id: appt.id,
        acuity_appointment_id: appointmentId,
        client_id: clientId,
        phone_normalized: appt.phone_normalized ?? null,
        appointment_date: appt.appointment_date,
        datetime: appt.datetime,
        revenue: appt.revenue,
        tip: appt.tip,
        service_type: appt.service_type || null,
        client_first_name: clientId ? clientMap[clientId]?.first_name || null : null,
        client_last_name: clientId ? clientMap[clientId]?.last_name || null : null,
      };
    });

    return NextResponse.json({
      appointments: transformedAppointments,
      total: transformedAppointments.length,
      date: selectedDate,
    });
  } catch (err: unknown) {
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

    const body = (await request.json()) as {
      id?: string;
      tip?: number | string | null;
      revenue?: number | string | null;
    };
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
      const tipValue = typeof tip === 'string' ? parseFloat(tip) : Number(tip);
      if (isNaN(tipValue) || tipValue < 0) {
        return NextResponse.json({ error: 'tip must be a valid non-negative number' }, { status: 400 });
      }
      updateData.tip = tipValue;
    }

    if (revenue !== undefined && revenue !== null) {
      const revenueValue = typeof revenue === 'string' ? parseFloat(revenue) : Number(revenue);
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
      .eq('user_id', user.id) 
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
  } catch (err: unknown) {
    console.error('Appointments PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
