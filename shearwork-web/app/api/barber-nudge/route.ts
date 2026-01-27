import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Extract Twilio webhook data
    const from = body.From // Customer's phone number
    const to = body.To // Your Twilio number
    const messageBody = body.Body // The reply text
    const messageSid = body.MessageSid
    
    // Normalize phone number (remove +1 prefix and any formatting)
    const normalizedPhone = from.replace(/^\+1/, '').replace(/\D/g, '')
    
    // Find the client by normalized phone number
    const { data: client } = await supabase
      .from('test_acuity_clients')
      .select('client_id, user_id, first_name, last_name')
      .eq('phone_normalized', normalizedPhone)
      .single()
    
    if (!client) {
      console.log('Client not found for phone:', normalizedPhone)
      return NextResponse.json({ success: false, error: 'Client not found' })
    }
    
    // Log the reply in your database
    await supabase
      .from('sms_replies')
      .insert({
        client_id: client.client_id,
        barber_id: client.user_id,
        phone_number: normalizedPhone,
        message: messageBody,
        message_sid: messageSid,
        received_at: new Date().toISOString()
      })
    
    // Update client engagement status
    await supabase
      .from('test_acuity_clients')
      .update({ 
        last_response_at: new Date().toISOString(),
        is_engaged: true,
        updated_at: new Date().toISOString()
      })
      .eq('client_id', client.client_id)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}