import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Twilio error code dictionary
const TWILIO_ERROR_CODES: Record<number, string> = {
  21210: 'Invalid phone number format',
  21211: 'Invalid "To" phone number',
  21408: 'Permission to send SMS not enabled',
  21610: 'Unsubscribed from SMS',
  21611: 'Message filtered (spam)',
  21612: 'Unreachable destination',
  21614: 'Not a valid mobile number',
  21617: 'Message flagged as spam',
  30001: 'Queue overflow (rate limiting)',
  30002: 'Account suspended',
  30003: 'Unreachable destination handset',
  30004: 'Message blocked by carrier',
  30005: 'Unknown destination handset',
  30006: 'Landline or unreachable carrier',
  30007: 'Message filtered (carrier)',
  30008: 'Unknown error',
  30009: 'Missing segment',
  30010: 'Message price exceeds max price',
  63016: 'Geo-permissions configuration error',
  63017: 'To number is not registered'
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()

    const messageStatus = formData.get('MessageStatus') as string
    const to = formData.get('To') as string
    const errorCode = formData.get('ErrorCode')
      ? Number(formData.get('ErrorCode'))
      : null

    if (!to) return NextResponse.json({ ok: true })

    const url = new URL(req.url)
    const user_id = url.searchParams.get('user_id')
    const client_id = url.searchParams.get('client_id')
    const message = url.searchParams.get('message')
    const message_id = url.searchParams.get('message_id')

    // Normalize phone to E.164 format
    const phoneNormalized = normalizePhone(to)
    if (!phoneNormalized) return NextResponse.json({ ok: true })

    // ✅ Delivered
    if (messageStatus === 'delivered') {
      const { error: insertError } = await supabase
        .from('sms_sent')
        .insert({
          user_id: user_id,
          client_id: client_id,
          message_id: message_id,
          is_sent: true,
          purpose: 'client_sms_barber_nudge',
          reason: null,
          phone_normalized: phoneNormalized,
          message: message
        })

      if (insertError) {
        console.error('Failed to insert delivered status:', insertError)
      }

      // Update client's last SMS sent timestamp
      if (client_id) {
        const { error: updateError } = await supabase
        // change to test_acuity_clients for testing
          .from('test_acuity_clients')
          .update({
            date_last_sms_sent: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('client_id', client_id)

        if (updateError) {
          console.error('Failed to update client last SMS sent:', updateError)
        }
      }

      return NextResponse.json({ ok: true })
    }

    // 🔴 Failed or Undelivered
    if (messageStatus === 'failed' || messageStatus === 'undelivered') {
      const failureReason = errorCode 
        ? TWILIO_ERROR_CODES[errorCode] || `Unknown error (code: ${errorCode})`
        : 'Unknown error'

      const { error: insertError } = await supabase
        .from('sms_sent')
        .insert({
          user_id: user_id,
          client_id: client_id,
          is_sent: false,
          purpose: 'client_sms_barber_nudge',
          reason: failureReason,
          phone_normalized: phoneNormalized,
          message: message
        })

      if (insertError) {
        console.error('Failed to insert failed status:', insertError)
      }

      return NextResponse.json({ ok: true })
    }

    // Ignore other statuses (sent, queued, etc.)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('SMS status webhook error:', error)
    return NextResponse.json({ ok: true })
  }
}

function normalizePhone(phone: string): string | null {
  // Keep digits only
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 10) return null
  // Always return E.164 format with +1
  const normalized = `+1${digits.slice(-10)}`
  return normalized
}