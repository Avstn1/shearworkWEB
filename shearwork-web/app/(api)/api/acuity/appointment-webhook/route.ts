import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { updateSmsBarberSuccess } from '@/lib/appointment_processors/update_sms_barber_success';
import { updateBarberClient } from '@/lib/appointment_processors/update_barber_client';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const ACUITY_API_BASE = 'https://acuityscheduling.com/api/v1';

export async function POST(req: NextRequest) {
  try {
    console.log('\n=== ACUITY WEBHOOK RECEIVED ===');
    
    // Get the raw body for signature verification
    const body = await req.text();
    console.log('\nRaw Body:', body);
    
    // Parse form data
    const formData = new URLSearchParams(body);
    const data: Record<string, string> = {};
    formData.forEach((value, key) => {
      data[key] = value;
    });
    
    console.log('\nParsed Form Data:', JSON.stringify(data, null, 2));
    
    const action = data.action;
    const appointmentId = data.id;
    const calendarId = data.calendarID;
    
    console.log('\n--- Webhook Details ---');
    console.log('Action:', action);
    console.log('Appointment ID:', appointmentId);
    console.log('Calendar ID:', calendarId);
    
    if (!appointmentId || !calendarId) {
      console.log('Missing appointment ID or calendar ID');
      return NextResponse.json({ ok: true });
    }
    
    // Find the user by calendar_id
    const { data: tokens, error: tokenError } = await supabase
      .from('acuity_tokens')
      .select('user_id, access_token')
      .eq('calendar_id', calendarId)
      .limit(1);

    const token = tokens?.[0];

    if (tokenError || !token) {
      console.error('Could not find user for calendar_id:', calendarId);
      console.error('Error:', tokenError);
      return NextResponse.json({ ok: true });
    }
    
    console.log(`\n✅ Found user: ${token.user_id}`);
    
    // Fetch appointment details from Acuity
    const response = await fetch(`${ACUITY_API_BASE}/appointments/${appointmentId}`, {
      headers: {
        'Authorization': `Bearer ${token.access_token}`,
      }
    });
    
    if (!response.ok) {
      console.error('Failed to fetch appointment:', await response.text());
      return NextResponse.json({ ok: true });
    }
    
    const appointmentDetails = await response.json();
    
    console.log('\n--- Appointment Details ---');
    console.log(JSON.stringify(appointmentDetails, null, 2));
    
    // Only process scheduled appointments for SMS tracking
    if (action === 'appointment.scheduled') {
      console.log('\n--- Checking SMS Campaign Attribution ---');
      const result = await updateSmsBarberSuccess(token.user_id, appointmentDetails);
      
      if (result.success && !result.reason) {
        console.log('✅ SMS campaign attribution tracked');

        // Log to system_logs on successful attribution
        const clientPhone = appointmentDetails.phone;
        if (clientPhone) {
          const [{ data: clientData }, { data: profileData }] = await Promise.all([
            supabase
              .from('acuity_clients')
              .select('first_name, last_name, phone_normalized')
              .eq('user_id', token.user_id)
              .eq('phone_normalized', clientPhone)
              .maybeSingle(),
            supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', token.user_id)
              .single()
          ]);

          const barberName = profileData?.full_name ?? 'Unknown Barber';
          const clientName = clientData
            ? `${clientData.first_name ?? ''} ${clientData.last_name ?? ''}`.trim()
            : `${appointmentDetails.firstName ?? ''} ${appointmentDetails.lastName ?? ''}`.trim();
          const clientNumber = clientData?.phone_normalized ?? clientPhone;

          await supabase
            .from('system_logs')
            .insert({
              source: 'SYSTEM',
              action: 'barber_nudge_success',
              status: 'success',
              details: `${barberName}: ${clientName} (${clientNumber}) booked`
            });
        }
      } else {
        console.log(`ℹ️  Not attributed to SMS campaign: ${result.reason}`);
      }
    }

    if (['appointment.scheduled', 'appointment.rescheduled', 'appointment.canceled'].includes(action)) {
      const result = await updateBarberClient(supabase, token.user_id, action, appointmentDetails);
      if (result.success) {
        console.log('✅ next_future_appointment updated');
      } else {
        console.log(`ℹ️  updateBarberClient skipped: ${result.reason}`);
      }
    }
        
    console.log('\n=== END WEBHOOK ===\n');
    
    // Return 200 to acknowledge receipt
    return NextResponse.json({ ok: true });
    
  } catch (error) {
    console.error('Error processing Acuity webhook:', error);
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}