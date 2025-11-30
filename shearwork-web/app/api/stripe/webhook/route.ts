'use server'

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover' as Stripe.LatestApiVersion,
})

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')!

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )

    const supabase = await createSupabaseServerClient()

    switch (event.type) {
      // -------------------------------
      // 1. CHECKOUT COMPLETED
      // -------------------------------
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        const customerId = session.customer as string
        const subscriptionId = session.subscription as string
        const supabaseUserId = session.metadata?.supabase_user_id

        if (!supabaseUserId) break

        await supabase
          .from('profiles')
          .update({
            stripe_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_status: 'active',
          })
          .eq('user_id', supabaseUserId)

        break
      }

      // -------------------------------
      // 2. SUBSCRIPTION UPDATED (renewals, paused, unpaid, etc)
      // -------------------------------
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription

        const customerId = sub.customer as string
        const status = sub.status

        await supabase
          .from('profiles')
          .update({
            stripe_subscription_id: sub.id,
            subscription_status: status,
          })
          .eq('stripe_id', customerId)

        break
      }

      // -------------------------------
      // 3. SUBSCRIPTION CANCELLED
      // -------------------------------
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = sub.customer as string

        await supabase
          .from('profiles')
          .update({
            stripe_subscription_id: null,
            subscription_status: 'canceled',
          })
          .eq('stripe_id', customerId)

        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error('❌ Webhook error:', err.message)
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 })
  }
}

export const dynamic = 'force-dynamic'
