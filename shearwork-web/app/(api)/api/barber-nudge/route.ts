import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSmartBuckets } from '@/lib/client_sms_from_barber_nudge/create_smart_buckets'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Callback function that gets activated when a barber replies
export async function POST(request: Request) {
  try {
    const formData = await request.formData()

    console.log("Running local version...")
    
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

    console.log("digits only: ", digitsOnly)
    
    // Find the profile by normalized phone number
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id, sms_engaged_current_week, trial_active, stripe_subscription_status, phone')
      .eq('phone', normalizedPhone)
      .single()
    
    if (!profile) {
      console.log('Barber not found for phone:', normalizedPhone)
      return NextResponse.json({ success: false, error: 'Barber not found' })
    }

    const hasActiveAccess = profile.stripe_subscription_status === 'active' || profile.trial_active === true
    
    if (!hasActiveAccess) {
      console.log('Barber does not have active subscription or trial')
      return NextResponse.json({ success: false, error: 'No active subscription or trial' })
    }

    // If the barber already said yes this week then don't run the nudge again.
    if (profile.sms_engaged_current_week) {
      console.log('Barber already said yes for this week')
      return NextResponse.json({ success: true, ignored: true })
    }

    // Any code below this point has the intention to send out messages to clients
    
    // Log the reply in the database
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
        sms_engaged_current_week: true,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', profile.user_id)
    
    if (updateError) {
      console.error('Failed to update profile engagement:', updateError)
    }

    // Create smart bucket for this barber
    console.log(`Creating smart bucket for user ${profile.user_id}`)

    const bucketResult = await createSmartBuckets(profile.user_id)

    if (!bucketResult.success) {
      console.error('createSmartBuckets failed:', bucketResult.error)
      return NextResponse.json({ 
        success: true, 
        warning: 'Reply logged but smart bucket creation failed',
        bucketError: bucketResult.error
      })
    }

    if (!bucketResult.bucket_id) {
      console.log(`No bucket created for user ${profile.user_id} (no recipients or already exists)`)
      return NextResponse.json({ success: true, campaignTriggered: false })
    }

    // Removed while testing. CHANGE LATER
    // const { error: notificationError } = await supabase
    //   .from('notifications')
    //   .insert({
    //     user_id: profile.user_id,
    //     header: "Weekly auto-nudge authorized",
    //     message: "Your weekly nudge has been authorized through SMS. We'll update you on Wednesday, 10am.",
    //     reference: bucketResult.bucket_id,
    //     reference_type: 'sms_auto_nudge',
    //   })

    // if (notificationError) {
    //   console.error('Failed to insert notification. Continuing without notification.', notificationError)
    // }

    console.log(`Smart bucket created: ${bucketResult.bucket_id}`)
    
    return NextResponse.json({ 
      success: true,
      campaignTriggered: true,
      bucket_id: bucketResult.bucket_id,
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}