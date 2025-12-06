import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'

// ⬅️ Required for Stripe webhooks (App Router)
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export interface StripeSubscriptionFixed {
  id: string
  status: string
  customer: string
  current_period_start: number
  current_period_end: number
  cancel_at: number | null
  canceled_at: number | null
  cancel_at_period_end: boolean
  [key: string]: any
}

// Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover' as Stripe.LatestApiVersion,
})

// 🚫 Removed — not supported in App Router anymore
// export const config = {
//   api: { bodyParser: false },
// }

export async function POST(req: Request) {
  // Get signature header from Next.js App Router
  const sig = (await headers()).get('stripe-signature')
  if (!sig) return new Response('Missing Stripe signature', { status: 400 })

  const rawBody = await req.text() // required for stripe.webhooks.constructEvent

  let event
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    console.error('❌ Webhook verification error:', err.message)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

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
        .update({
          subscription_id: sub.id,
          stripe_subscription_status: sub.status,
          cancel_at_period_end: sub.cancel_at_period_end,
        })
        .eq('stripe_id', sub.customer as string)
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await supabase
        .from('profiles')
        .update({
          subscription_id: null,
          stripe_subscription_status: 'canceled',
        })
        .eq('stripe_id', sub.customer as string)
      break
    }
  }

  return Response.json({ received: true })
}
