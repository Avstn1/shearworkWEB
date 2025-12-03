'use server'

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getAuthenticatedUser } from '@/utils/api-auth'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover' as Stripe.LatestApiVersion,
})

type Plan = 'monthly' | 'yearly'

export async function POST(request: Request) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Read plan from body, default to 'monthly' if missing/invalid
    let plan: Plan = 'monthly'
    try {
      const body = await request.json()
      if (body?.plan === 'yearly') {
        plan = 'yearly'
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

    // Create a new customer for this payment
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: {
        supabase_user_id: user.id,
      },
    })

    // Create subscription with payment intent
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        supabase_user_id: user.id,
        plan,
      },
    })

    const invoice = subscription.latest_invoice as Stripe.Invoice
    const paymentIntent = (invoice as any).payment_intent as Stripe.PaymentIntent

    if (!paymentIntent?.client_secret) {
      return NextResponse.json(
        { error: 'No payment intent client secret returned' },
        { status: 500 },
      )
    }

    // Create ephemeral key for Payment Sheet
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customer.id },
      { apiVersion: '2025-11-17.clover' }
    )

    return NextResponse.json({
      paymentIntent: paymentIntent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: customer.id,
      subscriptionId: subscription.id,
    })
  } catch (err: any) {
    console.error('Payment intent error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to create payment intent' },
      { status: 500 },
    )
  }
}