// app/api/stripe/billing-summary/route.ts
'use server'

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover' as Stripe.LatestApiVersion,
})

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_id, stripe_subscription_status, cancel_at_period_end')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('Billing summary profile error:', profileError)
      return NextResponse.json(
        { error: 'Failed to load profile' },
        { status: 500 },
      )
    }

    // No active subscription stored
    if (
      !profile?.subscription_id ||
      profile.stripe_subscription_status !== 'active'
    ) {
      return NextResponse.json({
        hasSubscription: false,
        cancel_at_period_end: profile?.cancel_at_period_end ?? false,
      })
    }

    // Retrieve subscription; use `any` so we can handle new preview fields
    const subscriptionResp = await stripe.subscriptions.retrieve(
      profile.subscription_id as string,
    )
    const subscription = subscriptionResp as any

    const items = (subscription.items?.data ?? []) as any[]
    const firstItem = items[0]

    // NEW: billing period end lives on the subscription item
    const itemCurrentPeriodEnd: number | null =
      firstItem?.current_period_end ?? null

    const price = firstItem?.price
    const amount: number = price?.unit_amount ?? 0
    const currency: string = price?.currency ?? 'usd'
    const interval: string | null = price?.recurring?.interval ?? null
    const interval_count: number | null =
      price?.recurring?.interval_count ?? null

    const cancel_at_period_end: boolean =
      subscription.cancel_at_period_end ?? false

    console.log('Billing summary subscription:', {
      id: subscription.id,
      cancel_at_period_end,
      current_period_end: itemCurrentPeriodEnd,
    })

    return NextResponse.json({
      hasSubscription: true,
      cancel_at_period_end,
      current_period_end: itemCurrentPeriodEnd, // unix timestamp (seconds)
      price: {
        amount,
        currency,
        interval,
        interval_count,
      },
    })
  } catch (err: any) {
    console.error('Billing summary error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to load billing summary' },
      { status: 500 },
    )
  }
}
