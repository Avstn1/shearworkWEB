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

    console.log('Selected plan:', plan)
    console.log('Price ID:', priceId)

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

    console.log('Customer created:', customer.id)

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

    console.log('Subscription created:', subscription.id)
    console.log('Subscription status:', subscription.status)
    console.log('Latest invoice type:', typeof subscription.latest_invoice)
    console.log('Latest invoice:', JSON.stringify(subscription.latest_invoice, null, 2))

    const invoice = subscription.latest_invoice as Stripe.Invoice
    console.log('Invoice ID:', invoice?.id)
    console.log('Invoice payment_intent:', (invoice as any)?.payment_intent)

    const paymentIntent = (invoice as any).payment_intent as Stripe.PaymentIntent
    console.log('Payment intent type:', typeof paymentIntent)
    console.log('Payment intent:', paymentIntent)
    console.log('Client secret:', paymentIntent?.client_secret)

    if (!paymentIntent?.client_secret) {
      console.error('FULL SUBSCRIPTION OBJECT:', JSON.stringify(subscription, null, 2))
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