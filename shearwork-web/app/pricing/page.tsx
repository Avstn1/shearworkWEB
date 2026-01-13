// app/pricing/page.tsx
'use client'

import React, { useEffect, useState, useRef, Suspense } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js'
import { Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/utils/supabaseClient'
import { useSearchParams, useRouter } from 'next/navigation'

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string,
)

type Plan = 'monthly' | 'yearly'

type PriceInfo = {
  id: string
  amount: number
  currency: string
  interval: string | null
  interval_count: number | null
}

type PricingResponse = {
  monthly: PriceInfo
  yearly: PriceInfo
}

// Loading component for Suspense fallback
function PricingPageLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#101312] via-[#1a1f1b] to-[#2e3b2b]">
      <Loader2 className="h-8 w-8 animate-spin text-[#7affc9]" />
      <p className="mt-4 text-gray-300">Loading...</p>
    </div>
  )
}

// Main pricing component
function PricingPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [pricing, setPricing] = useState<PricingResponse | null>(null)
  const [loadingPrices, setLoadingPrices] = useState(true)
  const [authenticating, setAuthenticating] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  // Handle authentication from mobile app code or existing session
  useEffect(() => {
    const authenticateUser = async () => {
      try {
        const code = searchParams.get('code')
        
        if (code) {
          // User came from mobile app with a one-time code
          const response = await fetch('/api/mobile-web-redirect/verify-web-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
          })

          const data = await response.json()
          
          if (!response.ok || !data.access_token) {
            toast.error(data.error || 'Invalid or expired code. Please try again from the app.')
            router.push('/login')
            return
          }

          // Set session with the tokens from the verified code
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token
          })

          if (sessionError) {
            console.error('Session error:', sessionError)
            throw sessionError
          }
          
          setUserId(data.user.id)
          toast.success('Successfully authenticated!')
          
          // Clean URL - remove the code parameter
          router.replace('/pricing')
          
        } else {
          // No code - check for existing web session
          const { data: { session } } = await supabase.auth.getSession()
          
          if (!session?.user) {
            toast.error('Please login to continue')
            router.push('/login')
            return
          }
          
          setUserId(session.user.id)
        }
      } catch (err: any) {
        console.error('Auth error:', err)
        toast.error('Authentication failed')
        router.push('/login')
      } finally {
        setAuthenticating(false)
      }
    }

    authenticateUser()
  }, [searchParams, router])

  // Fetch prices from our API
  useEffect(() => {
    if (!userId) return

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
  }, [userId])

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
        body: JSON.stringify({ plan }),
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

  // Show loading state while authenticating
  if (authenticating) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#101312] via-[#1a1f1b] to-[#2e3b2b]">
        <Loader2 className="h-8 w-8 animate-spin text-[#7affc9]" />
        <p className="mt-4 text-gray-300">Authenticating...</p>
      </div>
    )
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
                Corva Pro (Monthly)
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
                Corva Pro (Yearly)
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

        <p className="mt-4 text-[11px] text-gray-400">
          All payments are processed securely by Stripe. You can manage or cancel
          your subscription at any time.
        </p>
      </div>

      {/* Modal: embedded checkout */}
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

// Export wrapped component with Suspense
export default function PricingPage() {
  return (
    <Suspense fallback={<PricingPageLoader />}>
      <PricingPageContent />
    </Suspense>
  )
}