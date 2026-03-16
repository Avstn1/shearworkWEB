import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { updateSmsBarberSuccess } from '@/lib/appointment_processors/update_sms_barber_success';
import { updateBarberClient } from '@/lib/appointment_processors/update_barber_client';
import { pullAvailability } from '@/lib/booking/availability/orchestrator';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const ACUITY_API_BASE = 'https://acuityscheduling.com/api/v1';

async function refreshAvailabilityForOpenBookings(userId: string) {
  const weekOffsets = [0, 1];
  const results = await Promise.allSettled(
    weekOffsets.map((weekOffset) =>
      pullAvailability(supabase, userId, {
        dryRun: false,
        forceRefresh: true,
        weekOffset,
      })
    )
  );

  results.forEach((result, index) => {
    const weekOffset = weekOffsets[index];
    if (result.status === 'fulfilled') {
      console.log(`✅ availability refreshed for weekOffset=${weekOffset}`);
      return;
    }

    console.error(`Failed to refresh availability for weekOffset=${weekOffset}:`, result.reason);
  });
}

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (raw.trimStart().startsWith('+') && digits.length >= 11) return `+${digits}`;
  return `+${digits}`;
}

export async function POST(req: NextRequest) {
  try {
    console.log('\n=== ACUITY WEBHOOK RECEIVED ===');
    
    const body = await req.text();
    console.log('\nRaw Body:', body);
    
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
    
    if (action === 'appointment.scheduled') {
      console.log('\n--- Checking SMS Campaign Attribution ---');
      const result = await updateSmsBarberSuccess(token.user_id, appointmentDetails);
      
      if (result.success && !result.reason) {
        console.log('✅ SMS campaign attribution tracked');

        const clientPhone = appointmentDetails.phone;
        if (clientPhone) {
          const normalizedPhone = normalizePhone(clientPhone);

          const [{ data: clientRows }, { data: profileData }] = await Promise.all([
            supabase
              .from('acuity_clients')
              .select('first_name, last_name, phone_normalized')
              .eq('user_id', token.user_id)
              .eq('phone_normalized', normalizedPhone),
            supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', token.user_id)
              .single()
          ]);

          const clientData = clientRows?.[0] ?? null;
          const barberName = profileData?.full_name ?? 'Unknown Barber';
          const clientName = clientData
            ? `${clientData.first_name ?? ''} ${clientData.last_name ?? ''}`.trim()
            : `${appointmentDetails.firstName ?? ''} ${appointmentDetails.lastName ?? ''}`.trim();
          const clientNumber = clientData?.phone_normalized ?? normalizedPhone ?? clientPhone;

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

      await refreshAvailabilityForOpenBookings(token.user_id);
    }
        
    console.log('\n=== END WEBHOOK ===\n');
    
    return NextResponse.json({ ok: true });
    
  } catch (error) {
    console.error('Error processing Acuity webhook:', error);
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
