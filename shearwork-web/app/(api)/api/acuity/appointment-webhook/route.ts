import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { updateSmsBarberSuccess } from '@/lib/acuity_webhooks/update_sms_barber_success';

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
    const { data: token, error: tokenError } = await supabase
      .from('acuity_tokens')
      .select('user_id, access_token')
      .eq('calendar_id', calendarId)
      .single();
    
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
    if (action === 'scheduled') {
      console.log('\n--- Checking SMS Campaign Attribution ---');
      const result = await updateSmsBarberSuccess(token.user_id, appointmentDetails);
      
      if (result.success) {
        console.log('✅ SMS campaign attribution tracked');
      } else {
        console.log(`ℹ️  Not attributed to SMS campaign: ${result.reason}`);
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