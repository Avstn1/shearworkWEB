import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Webhook for when a client replies to a barber's SMS nudge
export async function POST(request: Request) {
  try {
    const formData = await request.formData()

    const from = formData.get('From') as string
    const messageBody = formData.get('Body') as string
    const messageSid = formData.get('MessageSid') as string

    console.log('Received client reply webhook:\n', { from, messageBody, messageSid })

    // Normalize the client's phone number
    const digitsOnly = from.replace(/\D/g, '')
    const normalizedPhone = digitsOnly.startsWith('1') ? `+${digitsOnly}` : `+1${digitsOnly}`

    // Find the most recent sms_sent row where this phone was the recipient
    // This tells us which barber (user_id) the client is replying to
    const { data: sentRow, error: sentError } = await supabase
      .from('sms_sent')
      .select('user_id, client_id, phone_normalized')
      .eq('phone_normalized', normalizedPhone)
      .eq('is_sent', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (sentError || !sentRow) {
      console.log('No matching sms_sent row for phone:', normalizedPhone)
      return NextResponse.json({ success: true, ignored: true })
    }

    const { user_id, client_id } = sentRow

    // Insert the reply into sms_replies
    const { error: insertError } = await supabase
      .from('sms_replies')
      .insert({
        user_id,
        phone_number: normalizedPhone,
        message: messageBody.trim(),
        message_sid: messageSid,
        source: 'client-reply',
        client_id: client_id ?? null,
        received_at: new Date().toISOString(),
      })

    if (insertError) {
      console.error('Failed to insert sms_reply:', insertError)
      return NextResponse.json({ error: 'Failed to log reply' }, { status: 500 })
    }

    console.log(`Client reply logged — user_id=${user_id} client_id=${client_id} phone=${normalizedPhone}`)

    return NextResponse.json({
      success: true,
      user_id,
      client_id,
    })

  } catch (error) {
    console.error('Client reply webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}