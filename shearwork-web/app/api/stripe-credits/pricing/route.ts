import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2025-11-17.clover' as Stripe.LatestApiVersion,
})

export async function GET() {
  try {
    const credits100PriceId = process.env.STRIPE_PRICE_ID_100CREDITS
    const credits250PriceId = process.env.STRIPE_PRICE_ID_250CREDITS
    const credits500PriceId = process.env.STRIPE_PRICE_ID_500CREDITS
    const credits1000PriceId = process.env.STRIPE_PRICE_ID_1000CREDITS

    if (!credits100PriceId || !credits250PriceId || !credits500PriceId || !credits1000PriceId) {
      return NextResponse.json(
        { error: 'Missing one or more STRIPE_PRICE_ID_*CREDITS environment variables' },
        { status: 500 },
      )
    }

    console.log('ENV CHECK:', {
     key: process.env.STRIPE_SECRET_KEY?.substring(0, 20),
     price100: process.env.STRIPE_PRICE_ID_100CREDITS,
     price250: process.env.STRIPE_PRICE_ID_250CREDITS,
     price500: process.env.STRIPE_PRICE_ID_500CREDITS,
     price1000: process.env.STRIPE_PRICE_ID_1000CREDITS,
   })

    // Fetch all credit price objects from Stripe
    const [price100, price250, price500, price1000] = await Promise.all([
      stripe.prices.retrieve(credits100PriceId),
      stripe.prices.retrieve(credits250PriceId),
      stripe.prices.retrieve(credits500PriceId),
      stripe.prices.retrieve(credits1000PriceId),
    ])

    // Helper: shape the price data for the client
    const formatPrice = (p: Stripe.Price) => ({
      id: p.id,
      amount: p.unit_amount ?? 0,               
      currency: p.currency,
    })

    return NextResponse.json({
      credits100: formatPrice(price100),
      credits250: formatPrice(price250),
      credits500: formatPrice(price500),
      credits1000: formatPrice(price1000),
    })
  } catch (err: any) {
    console.error('Error fetching Stripe credit prices:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to fetch credit prices' },
      { status: 500 },
    )
  }
}