import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover' as Stripe.LatestApiVersion,
})

export async function GET() {
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
      .select('stripe_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('Failed to load profile:', profileError)
      return NextResponse.json(
        { error: 'Failed to load profile' },
        { status: 500 }
      )
    }

    // No Stripe customer ID means no payment method
    if (!profile?.stripe_id) {
      return NextResponse.json({ hasPaymentMethod: false })
    }

    // Check if customer has any payment methods
    const paymentMethods = await stripe.customers.listPaymentMethods(
      profile.stripe_id,
      { type: 'card', limit: 1 }
    )

    return NextResponse.json({
      hasPaymentMethod: paymentMethods.data.length > 0,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to check payment method'
    console.error('Payment method check error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
