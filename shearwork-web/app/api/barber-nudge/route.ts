import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ClientSMSFromBarberNudge } from '@/lib/client_sms_from_barber_nudge/index'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Callback function that gets activated when a barber replies
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    
    // Extract Twilio webhook data
    const from = formData.get('From') as string 
    const to = formData.get('To') as string 
    const messageBody = formData.get('Body') as string 
    const messageSid = formData.get('MessageSid') as string
    
    // Only process if the reply is "yes" (case-insensitive)
    if (messageBody.trim().toLowerCase() !== 'yes') {
      console.log('Reply is not "yes", ignoring:', messageBody)
      return NextResponse.json({ success: true, ignored: true })
    }
    
    // Ensure phone number is in E.164 format (+1XXXXXXXXXX)
    const digitsOnly = from.replace(/\D/g, '')
    const normalizedPhone = digitsOnly.startsWith('1') ? `+${digitsOnly}` : `+1${digitsOnly}`
    
    // Find the profile by normalized phone number
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('phone', normalizedPhone)
      .single()
    
    if (!profile) {
      console.log('Barber not found for phone:', normalizedPhone)
      return NextResponse.json({ success: false, error: 'Barber not found' })
    }
    
    // Log the reply in your database
    const { error: insertError } = await supabase
      .from('sms_replies')
      .insert({
        user_id: profile.user_id,
        phone_number: normalizedPhone,
        message: messageBody.trim().toLowerCase(),
        source: 'barber-nudge',
        message_sid: messageSid,
        received_at: new Date().toISOString()
      })
    
    if (insertError) {
      console.error('Failed to insert SMS reply:', insertError)
      return NextResponse.json({ error: 'Failed to log reply' }, { status: 500 })
    }
    
    // Update profile engagement status
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        last_sms_engaged: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', profile.user_id)
    
    if (updateError) {
      console.error('Failed to update profile engagement:', updateError)
    }

    
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}