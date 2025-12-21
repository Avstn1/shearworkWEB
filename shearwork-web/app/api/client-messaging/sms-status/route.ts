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

export async function POST(req: NextRequest) {
  const formData = await req.formData()

  const messageStatus = formData.get('MessageStatus') as string
  const to = formData.get('To') as string
  const errorCode = formData.get('ErrorCode')
    ? Number(formData.get('ErrorCode'))
    : null

  if (!to) return NextResponse.json({ ok: true })

  // 🔑 Normalize phone to match phone_normalized in DB
  const phoneNormalized = normalizePhone(to)
  if (!phoneNormalized) return NextResponse.json({ ok: true })

  // 🔴 STOP / Unsubscribed
  if (messageStatus === 'undelivered' && errorCode === 21610) {
    await supabase
      .from('acuity_clients')
      .update({
        sms_subscribed: false,
        updated_at: new Date().toISOString()
      })
      .eq('phone_normalized', phoneNormalized)

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

    // NEW: Deduct 1 from reserved credits (successful delivery)
    await handleCreditDeduction(phoneNormalized, 'success')

    return NextResponse.json({ ok: true })
  }

  // 🔴 Failed delivery → refund to available credits
  if (messageStatus === 'failed' || messageStatus === 'undelivered') {
    // NEW: Move 1 credit from reserved back to available
    await handleCreditDeduction(phoneNormalized, 'failed')

    return NextResponse.json({ ok: true })
  }

  // Ignore everything else
  return NextResponse.json({ ok: true })
}

/**
 * Handle credit deduction based on delivery status
 */
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

/**
 * Normalize phone numbers to exactly match your DB phone_normalized format.
 * Adjust if your DB format changes (here assumes +1XXXXXXXXXX)
 */
function normalizePhone(phone: string): string | null {
  // Keep digits only
  const digits = phone.replace(/\D/g, '')

  // Require at least 10 digits (US numbers)
  if (digits.length < 10) return null

  // Return as +1XXXXXXXXXX (last 10 digits)
  return `+1${digits.slice(-10)}`
}