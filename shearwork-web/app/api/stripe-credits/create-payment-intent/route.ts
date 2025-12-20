'use server'

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover',
})

type CreditPackage = '100' | '250' | '500' | '1000'

// Price mapping (in cents)
const PACKAGE_PRICES = {
  '100': 6500,   
  '250': 14500, 
  '500': 27500,  
  '1000': 50000,  
}

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

    // Read credit package from body, default to '100' if missing/invalid
    let creditPackage: CreditPackage = '100'
    try {
      const body = await req.json()
      if (['100', '250', '500', '1000'].includes(body?.package)) {
        creditPackage = body.package
      }
    } catch {
      // no body / invalid JSON -> keep default '100'
    }

    const amount = PACKAGE_PRICES[creditPackage]

    if (!amount) {
      return NextResponse.json(
        {
          error: `Invalid credit package: ${creditPackage}`,
        },
        { status: 400 },
      )
    }

    // Create or retrieve customer
    let customerId: string
    
    // Check if customer already exists with this email
    const existingCustomers = await stripe.customers.list({
      email: user.email ?? undefined,
      limit: 1,
    })

    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id
    } else {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: {
          supabase_user_id: user.id,
        },
      })
      customerId = customer.id
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      customer: customerId,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        supabase_user_id: user.id,
        credit_package: creditPackage,
      },
      description: `${creditPackage} credits purchase`,
    })

    if (!paymentIntent.client_secret) {
      return NextResponse.json(
        { error: 'No client_secret returned from Stripe' },
        { status: 500 },
      )
    }

    return NextResponse.json({ 
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    })
  } catch (err: any) {
    console.error('Stripe payment intent error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to create payment intent' },
      { status: 500 },
    )
  }
}