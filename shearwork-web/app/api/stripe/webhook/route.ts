
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover' as Stripe.LatestApiVersion,
})

// ⚠️ Disable automatic body parsing for Stripe webhook
export const config = {
  api: {
    bodyParser: false,
  },
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature')
  if (!signature) return new NextResponse('Missing Stripe signature', { status: 400 })

  const body = await req.text() // raw body is required

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )

    const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const supabaseUserId = session.metadata?.supabase_user_id
        if (!supabaseUserId) break

        await supabase
          .from('profiles')
          .upsert({
            user_id: supabaseUserId,
            stripe_id: session.customer as string,
            subscription_id: session.subscription as string,
            stripe_subscription_status: 'active',
          })
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        await supabase
          .from('profiles')
          .upsert({
            stripe_id: sub.customer as string,
            subscription_id: sub.id,
            stripe_subscription_status: sub.status,
          })
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await supabase
          .from('profiles')
          .upsert({
            stripe_id: sub.customer as string,
            subscription_id: null,
            stripe_subscription_status: 'canceled',
          })
        break
      }
    }
    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error('❌ Webhook error:', err.message)
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 })
  }
}
