'use server'

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { TRIAL_DAYS } from '@/lib/constants/trial'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover' as Stripe.LatestApiVersion,
})

type Plan = 'trial' | 'monthly' | 'yearly'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Read plan from body, default to 'monthly' if missing/invalid
    let plan: Plan = 'monthly'
    try {
      const body = await req.json()
      if (body?.plan === 'yearly') {
        plan = 'yearly'
      } else if (body?.plan === 'trial') {
        plan = 'trial'
      }

    } catch {
      // no body / invalid JSON -> keep default 'monthly'
    }

    const priceId =
      plan === 'yearly'
        ? process.env.STRIPE_PRICE_ID_YEARLY
        : process.env.STRIPE_PRICE_ID_MONTHLY

    if (!priceId) {
      return NextResponse.json(
        {
          error:
            'Stripe price ID is not configured (check STRIPE_PRICE_ID_MONTHLY / STRIPE_PRICE_ID_YEARLY)',
        },
        { status: 500 },
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('trial_start, stripe_id, subscription_id, stripe_subscription_status')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('Failed to load billing profile:', profileError)
      return NextResponse.json(
        { error: 'Failed to verify subscription status' },
        { status: 500 },
      )
    }

    const status = profile?.stripe_subscription_status ?? ''
    const hasActiveSub = status === 'active' || status === 'trialing'
    if (hasActiveSub) {
      return NextResponse.json(
        { error: 'You already have an active subscription.' },
        { status: 409 },
      )
    }

    const existingSubscriptionId =
      typeof profile?.subscription_id === 'string'
        ? profile.subscription_id.trim()
        : ''

    if (existingSubscriptionId) {
      try {
        const existingSubscription = await stripe.subscriptions.retrieve(existingSubscriptionId)
        if (existingSubscription.status === 'active' || existingSubscription.status === 'trialing') {
          return NextResponse.json(
            { error: 'You already have an active subscription.' },
            { status: 409 },
          )
        }
      } catch (subscriptionErr) {
        console.warn(
          'Failed to verify existing Stripe subscription before checkout:',
          subscriptionErr,
        )
      }
    }

    let fallbackCustomerIdFromEmail = ''
    if (user.email) {
      try {
        const customersByEmail = await stripe.customers.list({
          email: user.email,
          limit: 100,
        })

        fallbackCustomerIdFromEmail = customersByEmail.data[0]?.id ?? ''

        for (const customer of customersByEmail.data) {
          const subscriptions = await stripe.subscriptions.list({
            customer: customer.id,
            status: 'all',
            limit: 100,
          })

          const hasExistingActiveSubscription = subscriptions.data.some(
            subscription =>
              subscription.status === 'active' || subscription.status === 'trialing'
          )

          if (hasExistingActiveSubscription) {
            return NextResponse.json(
              { error: 'You already have an active subscription.' },
              { status: 409 },
            )
          }
        }
      } catch (emailLookupErr) {
        console.warn('Failed to verify Stripe subscriptions by email:', emailLookupErr)
      }
    }

    if (plan === 'trial') {
      const hasUsedTrial = Boolean(profile?.trial_start)
      if (hasUsedTrial) {
        return NextResponse.json(
          { error: 'Trial already used for this account' },
          { status: 400 },
        )
      }
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    let customerId =
      typeof profile?.stripe_id === 'string'
        ? profile.stripe_id.trim()
        : ''

    if (customerId) {
      try {
        const existingCustomer = await stripe.customers.retrieve(customerId)
        if ('deleted' in existingCustomer && existingCustomer.deleted) {
          customerId = ''
        }
      } catch (customerErr) {
        console.warn('Failed to load existing Stripe customer, creating a new one:', customerErr)
        customerId = ''
      }
    }

    if (!customerId && fallbackCustomerIdFromEmail) {
      customerId = fallbackCustomerIdFromEmail
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: {
          supabase_user_id: user.id,
        },
      })
      customerId = customer.id

      const { error: saveCustomerError } = await supabase
        .from('profiles')
        .update({ stripe_id: customerId })
        .eq('user_id', user.id)

      if (saveCustomerError) {
        console.error('Failed to persist Stripe customer ID:', saveCustomerError)
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      ui_mode: 'embedded',
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      return_url: `${baseUrl}/pricing/return?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        supabase_user_id: user.id,
        plan, // so you can see which plan they picked in Stripe
      },
      ...(plan === 'trial' ? { subscription_data: { trial_period_days: TRIAL_DAYS } } : {}),
    })

    if (!session.client_secret) {
      return NextResponse.json(
        { error: 'No client_secret returned from Stripe' },
        { status: 500 },
      )
    }

    return NextResponse.json({ clientSecret: session.client_secret })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create checkout session'
    console.error('Stripe checkout session error:', message)
    return NextResponse.json(
      { error: message },
      { status: 500 },
    )
  }
}
