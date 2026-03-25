// /api/barber-nudge/manual-smart-bucket/route.ts

import { NextResponse } from 'next/server'
import { createSmartBuckets } from '@/lib/client_sms_from_barber_nudge/create_smart_buckets'
import { getAuthenticatedUser } from '@/utils/api-auth'

export async function POST(request: Request) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user_id = user.id

    // Fetch profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id, phone, sms_engaged_current_week, trial_active, stripe_subscription_status')
      .eq('user_id', user_id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const hasActiveAccess = profile.stripe_subscription_status === 'active' || profile.trial_active === true

    if (!hasActiveAccess) {
      return NextResponse.json({ error: 'No active subscription or trial' }, { status: 403 })
    }

    if (profile.sms_engaged_current_week) {
      return NextResponse.json({ success: true, ignored: true, reason: 'Already engaged this week' })
    }

    // Log the manual trigger
    const { error: insertError } = await supabase
      .from('sms_replies')
      .insert({
        user_id: profile.user_id,
        phone_number: profile.phone,
        message: 'Manually triggered from application',
        source: 'barber-nudge',
        received_at: new Date().toISOString()
      })

    if (insertError) {
      console.error('Failed to insert SMS reply:', insertError)
      return NextResponse.json({ error: 'Failed to log trigger' }, { status: 500 })
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

    // Create smart bucket
    console.log(`Creating smart bucket for user ${profile.user_id}`)

    const bucketResult = await createSmartBuckets(profile.user_id)

    if (!bucketResult.success) {
      console.error('createSmartBuckets failed:', bucketResult.error)
      return NextResponse.json({
        success: true,
        warning: 'Trigger logged but smart bucket creation failed',
        bucketError: bucketResult.error
      })
    }

    if (!bucketResult.bucket_id) {
      console.log(`No bucket created for user ${profile.user_id} (no recipients or already exists)`)
      return NextResponse.json({ success: true, campaignTriggered: false })
    }

    const { error: notificationError } = await supabase
      .from('notifications')
      .insert({
        user_id: profile.user_id,
        header: 'Weekly auto-nudge authorized',
        message: "Your weekly nudge has been authorized. We'll update you on Sunday, 10pm.",
        reference: bucketResult.bucket_id,
        reference_type: 'sms_auto_nudge',
      })

    if (notificationError) {
      console.error('Failed to insert notification. Continuing without notification.', notificationError)
    }

    console.log(`Smart bucket created: ${bucketResult.bucket_id}`)

    return NextResponse.json({
      success: true,
      campaignTriggered: true,
      bucket_id: bucketResult.bucket_id,
    })

  } catch (error) {
    console.error('Manual trigger error:', error)
    return NextResponse.json({ error: 'Failed to trigger nudge' }, { status: 500 })
  }
}