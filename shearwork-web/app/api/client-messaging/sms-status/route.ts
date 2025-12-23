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
  const purpose = url.searchParams.get('purpose') as 'test_message' | 'campaign' | 'mass' | null;

  // 🔑 Normalize phone to match phone_normalized in DB
  const phoneNormalized = normalizePhone(to)
  if (!phoneNormalized) return NextResponse.json({ ok: true })

  // Get client_id if this is not a test message
  let client_id: string | null = null;
  if (purpose !== 'test_message') {
    client_id = await getClientId(phoneNormalized);
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

  // ✅ Delivered → update last SMS sent timestamp AND handle credits
  if (messageStatus === 'delivered') {
    // Only update client record for non-test messages
    if (purpose !== 'test_message') {
      await supabase
        .from('acuity_clients_testing')
        .update({
          date_last_sms_sent: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('phone_normalized', phoneNormalized)
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
        client_id: client_id
      })

    // Handle credit deduction based on message purpose
    // if (purpose === 'test_message' && user_id) {
    //   await handleTestMessageCredit(user_id, 'success')
    // } else if (phoneNormalized) {
    //   await handleCreditDeduction(phoneNormalized, 'success')
    // }

    return NextResponse.json({ ok: true })
  }

  // 🔴 Failed delivery → refund credits
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
      await handleTestMessageCredit(user_id, 'failed')
    } 
    // else if (phoneNormalized) {
    //   await handleCreditDeduction(phoneNormalized, 'failed')
    // }

    return NextResponse.json({ ok: true })
  }

  // Ignore everything else
  return NextResponse.json({ ok: true })
}

async function getClientId(phoneNormalized: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('acuity_clients_testing')
      .select('client_id')
      .eq('phone_normalized', phoneNormalized)
      .single()
    
    return data?.client_id || null
  } catch (error) {
    console.error('Error fetching client_id:', error)
    return null
  }
}

async function handleTestMessageCredit(
  userId: string,
  status: 'success' | 'failed'
) {
  try {
    // Check if this is over the 10th test message today
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data: testMessages } = await supabase
      .from('sms_sent')
      .select('id')
      .eq('user_id', userId)
      .eq('purpose', 'test_message')
      .eq('is_sent', true)
      .gte('created_at', today.toISOString())

    const testCount = testMessages?.length || 0

    // If this is the 11th+ test message, handle credit deduction
    if (testCount > 10) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('available_credits')
        .eq('user_id', userId)
        .single()

      if (!profile) {
        console.log(`⚠️ No profile found for user ${userId}`)
        return
      }

      if (status === 'success') {
        // Deduct 1 from available credits (not reserved)
        await supabase
          .from('profiles')
          .update({
            available_credits: Math.max(0, (profile.available_credits || 0) - 1),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)

      } else {
        // Refund: add back to available credits
        await supabase
          .from('profiles')
          .update({
            available_credits: (profile.available_credits || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
      }
    }
  } catch (error) {
    console.error('❌ Test message credit handling error:', error)
  }
}

// async function handleCreditDeduction(
//   phoneNormalized: string,
//   status: 'success' | 'failed'
// ) {
//   try {
//     // Get user_id from client phone
//     const { data: client } = await supabase
//       .from('acuity_clients_testing')
//       .select('user_id')
//       .eq('phone_normalized', phoneNormalized)
//       .single()

//     if (!client?.user_id) {
//       console.log(`⚠️ No user found for phone ${phoneNormalized}`)
//       return
//     }

//     // Get current credits
//     const { data: profile } = await supabase
//       .from('profiles')
//       .select('available_credits, reserved_credits')
//       .eq('user_id', client.user_id)
//       .single()

//     if (!profile) {
//       console.log(`⚠️ No profile found for user ${client.user_id}`)
//       return
//     }

//     if (status === 'success') {
//       // Just deduct 1 from reserved (credit is consumed)
//       await supabase
//         .from('profiles')
//         .update({
//           reserved_credits: Math.max(0, (profile.reserved_credits || 0) - 1),
//           updated_at: new Date().toISOString()
//         })
//         .eq('user_id', client.user_id)

//     } else {
//       // Refund: deduct from reserved, add back to available
//       await supabase
//         .from('profiles')
//         .update({
//           reserved_credits: Math.max(0, (profile.reserved_credits || 0) - 1),
//           available_credits: (profile.available_credits || 0) + 1,
//           updated_at: new Date().toISOString()
//         })
//         .eq('user_id', client.user_id)
//     }
//   } catch (error) {
//     console.error('❌ Credit deduction error:', error)
//   }
// }

function normalizePhone(phone: string): string | null {
  // Keep digits only
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 10) return null
  return `+1${digits.slice(-10)}`
}