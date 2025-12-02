import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2025-11-17.clover' as Stripe.LatestApiVersion,
})

export async function GET() {
  try {
    const monthlyPriceId = process.env.STRIPE_PRICE_ID_MONTHLY
    const yearlyPriceId = process.env.STRIPE_PRICE_ID_YEARLY

    if (!monthlyPriceId || !yearlyPriceId) {
      return NextResponse.json(
        { error: 'Missing STRIPE_PRICE_ID_MONTHLY or STRIPE_PRICE_ID_YEARLY' },
        { status: 500 },
      )
    }

    // Fetch both price objects from Stripe
    const [monthlyPrice, yearlyPrice] = await Promise.all([
      stripe.prices.retrieve(monthlyPriceId),
      stripe.prices.retrieve(yearlyPriceId),
    ])

    // Helper: shape the price data for the client
    const formatPrice = (p: Stripe.Price) => ({
      id: p.id,
      amount: p.unit_amount ?? 0,               // amount in cents
      currency: p.currency,
      interval: p.recurring?.interval ?? null,  // "month" | "year"
      interval_count: p.recurring?.interval_count ?? null,
    })

    return NextResponse.json({
      monthly: formatPrice(monthlyPrice),
      yearly: formatPrice(yearlyPrice),
    })
  } catch (err: any) {
    console.error('Error fetching Stripe prices:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to fetch prices' },
      { status: 500 },
    )
  }
}
