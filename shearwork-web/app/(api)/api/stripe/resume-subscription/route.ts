// app/api/stripe/resume-subscription/route.ts
'use server'

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set')
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-11-17.clover' as Stripe.LatestApiVersion,
})

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('Auth error in resume-subscription:', authError)
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('Profile load error:', profileError)
      return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 })
    }

    if (!profile?.subscription_id) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 400 })
    }

    // Trim whitespace / newlines from the stored ID
    const subscriptionId = (profile.subscription_id as string)
      .trim()
      .replace(/[\r\n]/g, '')

    console.log('Resuming subscription:', subscriptionId)

    const updated = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false, // <-- key difference from cancel route
    })

    console.log('Stripe subscription updated:', updated.id, updated.status)

    return NextResponse.json({ success: true, subscription: updated })
  } catch (err: any) {
    console.error('Resume subscription error:', err)

    const msg =
      err?.raw?.message ||
      err?.message ||
      'Failed to resume subscription'

    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
