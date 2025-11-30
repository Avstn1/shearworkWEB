// app/api/stripe/cancel-subscription/route.ts
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
      console.error('Auth error in cancel-subscription:', authError)
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_id')
      .eq('user_id', user.id)
      .maybeSingle()

    console.log('Profile in cancel-subscription route:', profile)

    if (profileError) {
      console.error('Profile load error:', profileError)
      return NextResponse.json(
        { error: 'Failed to load profile' },
        { status: 500 },
      )
    }

    if (!profile?.subscription_id) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 400 },
      )
    }

    // Trim whitespace / newlines from the stored ID
    const subscriptionId = (profile.subscription_id as string)
      .trim()
      .replace(/[\r\n]/g, '')

    console.log('Attempting to cancel subscription:', JSON.stringify(subscriptionId))

    const cancelled = await stripe.subscriptions.cancel(subscriptionId)
    console.log(
      'Stripe cancelled subscription:',
      cancelled.id,
      cancelled.status,
    )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Cancel subscription error:', err)

    const msg =
      err?.raw?.message ||
      err?.message ||
      'Failed to cancel subscription'

    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
