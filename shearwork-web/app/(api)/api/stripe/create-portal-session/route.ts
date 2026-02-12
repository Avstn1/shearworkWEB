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

    // You MUST have stored the customer's stripe ID after subscription
    const { data: dbUser } = await supabase
      .from('profiles')
      .select('stripe_id')
      .eq('user_id', user.id)
      .single()

    if (!dbUser?.stripe_id) {
      return NextResponse.json(
        { error: 'No Stripe customer found' },
        { status: 400 }
      )
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: dbUser.stripe_id,
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/settings?tab=billing`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (err: any) {
    console.error('Portal session error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to create portal session' },
      { status: 500 }
    )
  }
}
