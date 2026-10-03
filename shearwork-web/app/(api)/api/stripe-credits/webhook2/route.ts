import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createSupabaseAdminClient } from '@/lib/supabaseServer'
import { adjustCredits } from '@/lib/credits'
import { isValidUUID } from '@/utils/validation'

// Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover' as Stripe.LatestApiVersion,
})

// Credit package mapping
const CREDIT_AMOUNTS: Record<string, number> = {
  '100': 100,
  '250': 250,
  '500': 500,
  '1000': 1000,
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature')
  if (!signature) return new NextResponse('Missing Stripe signature', { status: 400 })

  const body = await req.text()

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_CREDITS_WEBHOOK2_SECRET! 
    )

    const supabase = createSupabaseAdminClient()

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent

      const supabaseUserId = paymentIntent.metadata?.supabase_user_id
      const creditPackage = paymentIntent.metadata?.credit_package

      if (!supabaseUserId || !creditPackage || !isValidUUID(supabaseUserId)) {
        console.error('Missing required metadata:', { supabaseUserId, creditPackage })
        return NextResponse.json({ received: true })
      }

      const creditsToAdd = CREDIT_AMOUNTS[creditPackage]
      if (!creditsToAdd) {
        console.error('Invalid credit package:', creditPackage)
        return NextResponse.json({ received: true })
      }

      // Atomic + idempotent: Stripe retries of the same payment intent add credits once
      let applied = false
      try {
        const result = await adjustCredits({
          userId: supabaseUserId,
          availableDelta: creditsToAdd,
          action: `Credits purchased - ${creditPackage} pack`,
          referenceId: paymentIntent.id,
          idempotencyKey: `stripe_pi:${paymentIntent.id}`,
        })
        applied = result.applied
      } catch (creditError) {
        console.error('Failed to add purchased credits:', creditError)
        // Let Stripe retry later
        return NextResponse.json({ error: 'Failed to add credits' }, { status: 500 })
      }

      if (!applied) {
        console.log(`ℹ️ Payment intent ${paymentIntent.id} already credited - skipping`)
        return NextResponse.json({ received: true })
      }

      // Create notification
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          user_id: supabaseUserId,
          header: 'Credits purchased',
          message: `${creditsToAdd} credits added to your account`,
          reference: paymentIntent.id,
          reference_type: 'credit_purchase',
        })

      if (notifError) {
        console.error('Failed to create notification:', notifError)
      }

      console.log(`✅ Added ${creditsToAdd} credits to user ${supabaseUserId}`)
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error('❌ Webhook error:', err.message)
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 })
  }
}