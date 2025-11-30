'use server'

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
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
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const priceId = process.env.STRIPE_PRICE_ID
    if (!priceId) {
      return NextResponse.json(
        { error: 'STRIPE_PRICE_ID is not configured' },
        { status: 500 },
      )
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    // Optional: you may want to look up / reuse a stored stripe_customer_id instead
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
    })

    if (!session.client_secret) {
      return NextResponse.json(
        { error: 'No client_secret returned from Stripe' },
        { status: 500 },
      )
    }

    return NextResponse.json({ clientSecret: session.client_secret })
  } catch (err: any) {
    console.error('Stripe checkout session error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to create checkout session' },
      { status: 500 },
    )
  }
}
