'use server'

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

// Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover' as Stripe.LatestApiVersion,
})

export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature')
  if (!signature) return new NextResponse('Missing Stripe signature', { status: 400 })

  const body = await req.text() // raw body

  try {
    // Verify Stripe signature
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )

    // Supabase client
    const supabase = (await createSupabaseServerClient()) as Awaited<
      ReturnType<typeof createSupabaseServerClient>
    >

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const supabaseUserId = session.metadata?.supabase_user_id
        if (!supabaseUserId) break

        await supabase
          .from('profiles')
          .update({
            stripe_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
            subscription_status: 'active',
          })
          .eq('user_id', supabaseUserId)

        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription

        await supabase
          .from('profiles')
          .update({
            stripe_subscription_id: sub.id,
            subscription_status: sub.status,
          })
          .eq('stripe_id', sub.customer as string)

        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription

        await supabase
          .from('profiles')
          .update({
            stripe_subscription_id: null,
            subscription_status: 'canceled',
          })
          .eq('stripe_id', sub.customer as string)

        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error('❌ Webhook error:', err.message)
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 })
  }
}
