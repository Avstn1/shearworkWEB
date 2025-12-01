'use client'

import React, { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string,
)

export default function PricingPage() {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

const startCheckout = async () => {
  try {
    setLoading(true)
    const res = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
    })

    const data = await res.json()
    console.log('create-checkout-session response:', res.status, data)

    if (!res.ok) {
      throw new Error(data.error || 'Failed to start checkout')
    }

    if (!data.clientSecret) {
      throw new Error('No clientSecret in response')
    }

    setClientSecret(data.clientSecret)
  } catch (err: any) {
    console.error(err)
    toast.error(err.message || 'Could not start checkout')
  } finally {
    setLoading(false)
  }
}


  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#101312] via-[#1a1f1b] to-[#2e3b2b] px-4">
      <div className="max-w-3xl w-full bg-black/30 border border-white/10 rounded-3xl shadow-2xl p-6 md:p-10 text-white">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">
          Choose your plan
        </h1>
        <p className="text-sm md:text-base text-gray-300 mb-6">
          Subscribe for <span className="font-semibold">$20 / month</span> to
          unlock full access to ShearWork&apos;s analytics dashboard.
        </p>

        <div className="mb-6 grid grid-cols-1 md:grid-cols-[1.3fr_2fr] gap-4">
          {/* Plan card */}
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10 flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-semibold mb-2">ShearWork Pro</h2>
              <p className="text-3xl font-bold mb-1">$20</p>
              <p className="text-xs uppercase tracking-wide text-gray-400 mb-4">
                per month • cancel anytime
              </p>
              <ul className="text-xs space-y-2 text-gray-200 mb-4">
                <li>• Full revenue, expense & profit dashboards</li>
                <li>• Marketing funnels & top clients analytics</li>
                <li>• Priority support and future features</li>
              </ul>
            </div>

            {!clientSecret && (
              <button
                onClick={startCheckout}
                disabled={loading}
                className="mt-4 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#7affc9] to-[#3af1f7] text-black font-semibold px-4 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {loading ? 'Starting checkout…' : 'Subscribe'}
              </button>
            )}
          </div>

          {/* Right side: embedded checkout / status */}
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            {!clientSecret && !loading && (
              <div className="flex flex-col items-center justify-center h-48 text-sm text-gray-300">
                Click <span className="font-semibold mx-1">Subscribe</span> to
                open secure checkout.
              </div>
            )}

            {loading && !clientSecret && (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-sm text-gray-200">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Preparing secure checkout…</span>
              </div>
            )}

            {clientSecret && (
              <EmbeddedCheckoutProvider
                stripe={stripePromise}
                options={{ clientSecret }}
              >
                <div className="min-h-[320px]">
                  <EmbeddedCheckout />
                </div>
              </EmbeddedCheckoutProvider>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
