import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export interface StripeSubscriptionFixed {
  id: string
  status: string
  customer: string
  current_period_start: number
  current_period_end: number
  cancel_at: number | null
  canceled_at: number | null
  cancel_at_period_end: boolean
  [key: string]: unknown // required because Stripe always adds more fields
}


// Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover' as Stripe.LatestApiVersion,
})

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

        const subscriptionId = session.subscription as string | null
        const customerId = session.customer as string | null
        let subscription: Stripe.Subscription | null = null

        if (subscriptionId) {
          subscription = await stripe.subscriptions.retrieve(subscriptionId)
        }

        const trialStart = subscription?.trial_start
          ? new Date(subscription.trial_start * 1000)
          : null
        const trialEnd = subscription?.trial_end
          ? new Date(subscription.trial_end * 1000)
          : null

        await supabase
          .from('profiles')
          .upsert({
            user_id: supabaseUserId,
            stripe_id: customerId,
            subscription_id: subscriptionId,
            stripe_subscription_status: subscription?.status ?? 'active',
            trial_start: trialStart ? trialStart.toISOString() : null,
            trial_end: trialEnd ? trialEnd.toISOString() : null,
            trial_active: subscription?.status === 'trialing',
          })

        if (session.metadata?.plan === 'trial') {
          const { data: existingBonus, error: bonusError } = await supabase
            .from('credit_transactions')
            .select('id')
            .eq('user_id', supabaseUserId)
            .eq('action', 'trial_bonus')
            .maybeSingle()

          if (bonusError) {
            console.error('Failed to check trial bonus:', bonusError)
            break
          }

          if (!existingBonus) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('available_credits, reserved_credits')
              .eq('user_id', supabaseUserId)
              .single()

            const oldAvailable = profile?.available_credits ?? 0
            const oldReserved = profile?.reserved_credits ?? 0
            const newAvailable = oldAvailable + 10

            const { error: creditUpdateError } = await supabase
              .from('profiles')
              .update({ available_credits: newAvailable })
              .eq('user_id', supabaseUserId)

            if (creditUpdateError) {
              console.error('Failed to apply trial credits:', creditUpdateError)
              break
            }

            const { error: transactionError } = await supabase
              .from('credit_transactions')
              .insert({
                user_id: supabaseUserId,
                action: 'trial_bonus',
                old_available: oldAvailable,
                new_available: newAvailable,
                old_reserved: oldReserved,
                new_reserved: oldReserved,
                reference_id: session.id,
                created_at: new Date().toISOString(),
              })

            if (transactionError) {
              console.error('Failed to log trial bonus:', transactionError)
            }
          }
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription

        const trialStart = sub.trial_start ? new Date(sub.trial_start * 1000) : null
        const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000) : null

        await supabase
          .from('profiles')
          .update({
            subscription_id: sub.id,
            stripe_subscription_status: sub.status,
            cancel_at_period_end: sub.cancel_at_period_end,
            trial_start: trialStart ? trialStart.toISOString() : null,
            trial_end: trialEnd ? trialEnd.toISOString() : null,
            trial_active: sub.status === 'trialing',
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
    return NextResponse.json({ received: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Webhook Error'
    console.error('❌ Webhook error:', message)
    return new NextResponse(`Webhook Error: ${message}`, { status: 400 })
  }
}
