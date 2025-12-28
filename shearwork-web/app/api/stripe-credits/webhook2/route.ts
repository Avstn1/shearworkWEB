import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

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

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent

      const supabaseUserId = paymentIntent.metadata?.supabase_user_id
      const creditPackage = paymentIntent.metadata?.credit_package

      if (!supabaseUserId || !creditPackage) {
        console.error('Missing required metadata:', { supabaseUserId, creditPackage })
        return NextResponse.json({ received: true })
      }

      const creditsToAdd = CREDIT_AMOUNTS[creditPackage]
      if (!creditsToAdd) {
        console.error('Invalid credit package:', creditPackage)
        return NextResponse.json({ received: true })
      }

      // Get current credit balance
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('available_credits, reserved_credits')
        .eq('user_id', supabaseUserId)
        .single()

      if (profileError || !profile) {
        console.error('Failed to fetch profile:', profileError)
        return NextResponse.json({ received: true })
      }

      const oldAvailable = profile.available_credits || 0
      const oldReserved = profile.reserved_credits || 0
      const newAvailable = oldAvailable + creditsToAdd
      const newReserved = oldReserved

      // Update available credits
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ available_credits: newAvailable })
        .eq('user_id', supabaseUserId)

      if (updateError) {
        console.error('Failed to update credits:', updateError)
        return NextResponse.json({ received: true })
      }

      // Log transaction
      const { error: transactionError } = await supabase
        .from('credit_transactions')
        .insert({
          barber_id: supabaseUserId,
          action: `Credits purchased - ${creditPackage} pack`,
          old_available: oldAvailable,
          new_available: newAvailable,
          old_reserved: oldReserved,
          new_reserved: newReserved,
        })

      if (transactionError) {
        console.error('Failed to log transaction:', transactionError)
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