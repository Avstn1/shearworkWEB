'use client'

import React, { useEffect, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js'
import { Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/utils/supabaseClient'

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string,
)

type Plan = 'monthly' | 'yearly'

type PriceInfo = {
  id: string
  amount: number // in cents
  currency: string
  interval: string | null
  interval_count: number | null
}

type PricingResponse = {
  monthly: PriceInfo
  yearly: PriceInfo
}

export default function PricingPage() {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [pricing, setPricing] = useState<PricingResponse | null>(null)
  const [loadingPrices, setLoadingPrices] = useState(true)

  // Fetch prices from our API (Stripe is called on the server)
  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const res = await fetch('/api/stripe/pricing')
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Failed to load pricing')
        }

        setPricing(data)
      } catch (err: any) {
        console.error(err)
        toast.error(err.message || 'Could not load pricing')
      } finally {
        setLoadingPrices(false)
      }
    }

    fetchPricing()
  }, [])

  const formatAmount = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(amount / 100)

  const startCheckout = async (plan: Plan) => {
    try {
      setLoading(true)
      setSelectedPlan(plan)

      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan }), // 'monthly' or 'yearly'
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
      setSelectedPlan(null)
    } finally {
      setLoading(false)
    }
  }

  const closeCheckout = () => {
    setClientSecret(null)
    setSelectedPlan(null)
  }

  const monthly = pricing?.monthly
  const yearly = pricing?.yearly

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#101312] via-[#1a1f1b] to-[#2e3b2b] px-4 pt-10">
      <div className="max-w-3xl w-full bg-black/30 border border-white/10 rounded-3xl shadow-2xl p-6 md:p-10 text-white">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">
          Choose your plan
        </h1>
        <p className="text-sm md:text-base text-gray-300 mb-6">
          Pick the plan that works best for your business. You can upgrade,
          downgrade, or cancel anytime.
        </p>

        {/* Plans grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Monthly plan */}
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10 flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-semibold mb-2">
                ShearWork Pro (Monthly)
              </h2>

              {loadingPrices || !monthly ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-6">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading price…</span>
                </div>
              ) : (
                <>
                  <p className="text-3xl font-bold mb-1">
                    {formatAmount(monthly.amount, monthly.currency)}
                  </p>
                  <p className="text-xs uppercase tracking-wide text-gray-400 mb-4">
                    per month • cancel anytime
                  </p>
                </>
              )}

              <ul className="text-xs space-y-2 text-gray-200 mb-4">
                <li>• Full revenue, expense & profit dashboards</li>
                <li>• Marketing funnels & top clients analytics</li>
                <li>• Priority support and future features</li>
              </ul>
            </div>

            <button
              onClick={() => startCheckout('monthly')}
              disabled={loading || loadingPrices || !monthly}
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#7affc9] to-[#3af1f7] text-black font-semibold px-4 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading && selectedPlan === 'monthly' && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {loading && selectedPlan === 'monthly'
                ? 'Starting checkout…'
                : 'Subscribe Monthly'}
            </button>
          </div>

          {/* Yearly plan */}
          <div className="bg-white/5 rounded-2xl p-4 border border-[#f5e29a]/40 flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-semibold mb-2">
                ShearWork Pro (Yearly)
              </h2>

              {loadingPrices || !yearly ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-6">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading price…</span>
                </div>
              ) : (
                <>
                  <p className="text-3xl font-bold mb-1">
                    {formatAmount(yearly.amount, yearly.currency)}
                  </p>
                  <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">
                    per year • cancel anytime
                  </p>
                  <p className="text-xs text-[#f5e29a] mb-4">
                    {/* simple hint – you can compute "save X%" here if you want */}
                    Best value for growing shops
                  </p>
                </>
              )}

              <ul className="text-xs space-y-2 text-gray-200 mb-4">
                <li>• Everything in Monthly Pro</li>
                <li>• Best value for long-term use</li>
                <li>• Locked-in yearly price</li>
              </ul>
            </div>

            <button
              onClick={() => startCheckout('yearly')}
              disabled={loading || loadingPrices || !yearly}
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#f5e29a] to-[#ffd28b] text-black font-semibold px-4 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading && selectedPlan === 'yearly' && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {loading && selectedPlan === 'yearly'
                ? 'Starting checkout…'
                : 'Subscribe Yearly'}
            </button>
          </div>
        </div>

        {/* Small helper text */}
        <p className="mt-4 text-[11px] text-gray-400">
          All payments are processed securely by Stripe. You can manage or cancel
          your subscription at any time.
        </p>
      </div>

      {/* Modal: embedded checkout in the middle of the screen */}
      {clientSecret && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="relative w-full max-w-xl bg-[#050608] border border-white/10 rounded-2xl p-4 md:p-6 shadow-2xl">
            <button
              onClick={closeCheckout}
              className="absolute top-3 right-3 inline-flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition px-1.5 py-1.5"
              aria-label="Close checkout"
            >
              <X className="w-4 h-4 text-gray-200" />
            </button>

            <h2 className="text-sm font-semibold text-gray-100 mb-2">
              Secure checkout
              {selectedPlan === 'monthly' && ' • Monthly plan'}
              {selectedPlan === 'yearly' && ' • Yearly plan'}
            </h2>

            <EmbeddedCheckoutProvider
              stripe={stripePromise}
              options={{ clientSecret }}
            >
              <div className="min-h-[360px]">
                <EmbeddedCheckout />
              </div>
            </EmbeddedCheckoutProvider>
          </div>
        </div>
      )}

      <div className="fixed top-4 left-4">
        <button
          onClick={async () => {
            toast.success('Logging out...')
            await supabase.auth.signOut()
            setTimeout(() => (window.location.href = '/login'), 700)
          }}
          className="px-4 py-2 bg-red-500/10 hover:bg-red-500/40 text-white font-medium rounded-2xl shadow-sm transition"
        >
          Logout
        </button>
      </div>
    </div>
  )
}
