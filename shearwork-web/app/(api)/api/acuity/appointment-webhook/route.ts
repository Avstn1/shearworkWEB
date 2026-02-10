import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    console.log('\n=== ACUITY WEBHOOK RECEIVED ===');
    
    // Log headers
    console.log('\nHeaders:');
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });
    console.log(JSON.stringify(headers, null, 2));
    
    // Get the raw body for signature verification
    const body = await req.text();
    console.log('\nRaw Body:');
    console.log(body);
    
    // Parse form data
    const formData = new URLSearchParams(body);
    const data: Record<string, string> = {};
    formData.forEach((value, key) => {
      data[key] = value;
    });
    
    console.log('\nParsed Form Data:');
    console.log(JSON.stringify(data, null, 2));
    
    // Extract specific fields
    console.log('\n--- Webhook Details ---');
    console.log('Action:', data.action);
    console.log('Appointment ID:', data.id);
    console.log('Calendar ID:', data.calendarID);
    console.log('Appointment Type ID:', data.appointmentTypeID);
    
    console.log('\n=== END WEBHOOK ===\n');
    
    // Return 200 to acknowledge receipt
    return NextResponse.json({ ok: true });
    
  } catch (error) {
    console.error('Error processing Acuity webhook:', error);
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}