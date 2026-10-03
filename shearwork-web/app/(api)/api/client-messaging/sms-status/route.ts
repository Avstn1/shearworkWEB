// /app/(api)/api/client-messaging/sms-status/route.ts
import { createSupabaseAdminClient } from '@/lib/supabaseServer'

import { NextRequest, NextResponse } from 'next/server'
import { verifyTwilioRequest } from '@/lib/api/guards'
import { adjustCredits } from '@/lib/credits'

const supabase = createSupabaseAdminClient()

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
  // Only accept requests signed by Twilio
  const params = await verifyTwilioRequest(req)
  if (!params) return NextResponse.json({ error: 'Invalid Twilio signature' }, { status: 403 })
  const formData = new URLSearchParams(params)

  const messageStatus = formData.get('MessageStatus') as string
  const to = formData.get('To') as string
  const errorCode = formData.get('ErrorCode')
    ? Number(formData.get('ErrorCode'))
    : null

  if (!to) return NextResponse.json({ ok: true })

  const url = new URL(req.url);
  const messageId = url.searchParams.get('messageId');
  const user_id = url.searchParams.get('user_id');
  const purpose = url.searchParams.get('purpose') as 'test_message' | 'campaign' | 'mass' | null;

  console.log(`MessageId: ${messageId}`)

  // 🔑 Normalize phone to match phone_normalized in DB
  const phoneNormalized = normalizePhone(to)
  if (!phoneNormalized) return NextResponse.json({ ok: true })

  // Get client_id if this is not a test message
  let client_id: string | null = null;

  if (purpose !== 'test_message') {
    client_id = await getClientId(phoneNormalized, user_id);
  }

  // 🔴 STOP / Unsubscribed
  if (messageStatus === 'undelivered' && errorCode === 21610) {
    // Update client subscription status (only for non-test messages)
    if (purpose !== 'test_message') {
      await supabase
        .from('acuity_clients')
        .update({
          sms_subscribed: false,
          updated_at: new Date().toISOString()
        })
        .eq('phone_normalized', phoneNormalized)
    }

    // Insert into sms_sent to track the failed delivery
    await supabase
      .from('sms_sent')
      .insert({
        message_id: messageId || null,
        user_id: user_id,
        is_sent: false,
        purpose: purpose,
        reason: TWILIO_ERROR_CODES[21610],
        phone_normalized: phoneNormalized,
        client_id: client_id
      })

    return NextResponse.json({ ok: true })
  }

  // ✅ Delivered → update last SMS sent timestamp
  if (messageStatus === 'delivered') {
    // Fetch message and cron from sms_scheduled_messages
    const { data: scheduledMessage } = await supabase
      .from('sms_scheduled_messages')
      .select('message, cron')
      .eq('id', messageId)
      .single();

    // Only update client record for non-test messages
    if (purpose !== 'test_message') {
      await supabase
        // acuity_clients change for testing
        .from('acuity_clients')
        .update({
          date_last_sms_sent: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('phone_normalized', phoneNormalized)
        .eq('user_id', user_id)
    }

    // Insert successful delivery record
    const { data: insertData, error: insertError } = await supabase
      .from('sms_sent')
      .insert({
        message_id: messageId || null,
        user_id: user_id,
        is_sent: true,
        purpose: purpose,
        reason: null,
        phone_normalized: phoneNormalized,
        client_id: client_id,
        message: scheduledMessage?.message || null,
        cron: scheduledMessage?.cron || null
      })

    return NextResponse.json({ ok: true })
  }

  // 🔴 Failed delivery
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
        reason: failureReason,
        phone_normalized: phoneNormalized,
        client_id: client_id
      })

    // Handle credit refund based on message purpose
    if (purpose === 'test_message' && user_id) {
      await refundFailedTestMessage(user_id, formData.get('MessageSid') ?? messageId ?? phoneNormalized)
    } 
    // else if (phoneNormalized) {
    //   await handleCreditDeduction(phoneNormalized, 'failed')
    // }

    return NextResponse.json({ ok: true })
  }

  // Ignore everything else
  return NextResponse.json({ ok: true })
}

async function getClientId(phoneNormalized: string, userId: string | null): Promise<string | null> {
  if (!userId) return null
  try {
    const { data } = await supabase
      .from('acuity_clients')
      .select('client_id')
      .eq('phone_normalized', phoneNormalized)
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()
    
    return data?.client_id || null
  } catch (error) {
    console.error('Error fetching client_id:', error)
    return null
  }
}

/**
 * Test messages are charged 1 credit when sent (qstash-sms-send). If Twilio reports
 * the send failed, refund it - once per Twilio message, since status callbacks repeat.
 */
async function refundFailedTestMessage(userId: string, twilioMessageKey: string) {
  try {
    await adjustCredits({
      userId,
      availableDelta: 1,
      action: 'Test message refund - delivery failed',
      referenceId: twilioMessageKey,
      idempotencyKey: `test_refund:${twilioMessageKey}`,
    })
  } catch (error) {
    console.error('❌ Test message refund error:', error)
  }
}

function normalizePhone(phone: string): string | null {
  // Keep digits only
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 10) return null
  return `+1${digits.slice(-10)}`
}