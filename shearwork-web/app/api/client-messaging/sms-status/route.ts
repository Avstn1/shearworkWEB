import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

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
  const formData = await req.formData()

  const messageStatus = formData.get('MessageStatus') as string
  const to = formData.get('To') as string
  const errorCode = formData.get('ErrorCode')
    ? Number(formData.get('ErrorCode'))
    : null

  if (!to) return NextResponse.json({ ok: true })

  const url = new URL(req.url);
  const messageId = url.searchParams.get('messageId');
  const user_id = url.searchParams.get('user_id');
  const purpose = url.searchParams.get('purpose');

  // 🔑 Normalize phone to match phone_normalized in DB
  const phoneNormalized = normalizePhone(to)
  if (!phoneNormalized) return NextResponse.json({ ok: true })

  // 🔴 STOP / Unsubscribed
  if (messageStatus === 'undelivered' && errorCode === 21610) {
    // Update client subscription status
    await supabase
      .from('acuity_clients')
      .update({
        sms_subscribed: false,
        updated_at: new Date().toISOString()
      })
      .eq('phone_normalized', phoneNormalized)

    // Insert into sms_sent to track the failed delivery
    await supabase
      .from('sms_sent')
      .insert({
        message_id: messageId || null,
        user_id: user_id,
        is_sent: false,
        purpose: purpose,
        reason: TWILIO_ERROR_CODES[21610]
      })

    return NextResponse.json({ ok: true })
  }

  // ✅ Delivered → update last SMS sent timestamp AND reduce reserved credits
  if (messageStatus === 'delivered') {
    await supabase
      .from('acuity_clients')
      .update({
        date_last_sms_sent: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('phone_normalized', phoneNormalized)

    // Insert successful delivery record
    await supabase
      .from('sms_sent')
      .insert({
        message_id: messageId || null,
        user_id: user_id,
        is_sent: true,
        purpose: purpose,
        reason: null
      })

    // NEW: Deduct 1 from reserved credits (successful delivery)
    await handleCreditDeduction(phoneNormalized, 'success')

    return NextResponse.json({ ok: true })
  }

  // 🔴 Failed delivery → refund to available credits
  if (messageStatus === 'failed' || messageStatus === 'undelivered') {
    const failureReason = errorCode 
      ? TWILIO_ERROR_CODES[errorCode] || `Unknown error (code: ${errorCode})`
      : 'Unknown error'

    await supabase
      .from('sms_sent')
      .insert({
        message_id: messageId || null,
        user_id: user_id,
        is_sent: false,
        purpose: purpose,
        reason: failureReason
      })

    // NEW: Move 1 credit from reserved back to available
    await handleCreditDeduction(phoneNormalized, 'failed')

    return NextResponse.json({ ok: true })
  }

  // Ignore everything else
  return NextResponse.json({ ok: true })
}

async function handleCreditDeduction(
  phoneNormalized: string,
  status: 'success' | 'failed'
) {
  try {
    // Get user_id from client phone
    const { data: client } = await supabase
      .from('acuity_clients')
      .select('user_id')
      .eq('phone_normalized', phoneNormalized)
      .single()

    if (!client?.user_id) {
      console.log(`⚠️ No user found for phone ${phoneNormalized}`)
      return
    }

    // Get current credits
    const { data: profile } = await supabase
      .from('profiles')
      .select('available_credits, reserved_credits')
      .eq('user_id', client.user_id)
      .single()

    if (!profile) {
      console.log(`⚠️ No profile found for user ${client.user_id}`)
      return
    }

    if (status === 'success') {
      // Just deduct 1 from reserved (credit is consumed)
      await supabase
        .from('profiles')
        .update({
          reserved_credits: Math.max(0, (profile.reserved_credits || 0) - 1),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', client.user_id)

      console.log(`✅ Deducted 1 reserved credit for successful delivery to ${phoneNormalized}`)
    } else {
      // Refund: deduct from reserved, add back to available
      await supabase
        .from('profiles')
        .update({
          reserved_credits: Math.max(0, (profile.reserved_credits || 0) - 1),
          available_credits: (profile.available_credits || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', client.user_id)

      console.log(`🔄 Refunded 1 credit for failed delivery to ${phoneNormalized}`)
    }
  } catch (error) {
    console.error('❌ Credit deduction error:', error)
  }
}

function normalizePhone(phone: string): string | null {
  // Keep digits only
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 10) return null
  return `+1${digits.slice(-10)}`
}