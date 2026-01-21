'use server'

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

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

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    // Optional improvement later: reuse a stored stripe_customer_id instead
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: {
        supabase_user_id: user.id,
      },
    })

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      ui_mode: 'embedded',
      customer: customer.id,
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
      subscription_data: {
        trial_period_days: 7,
      },
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
