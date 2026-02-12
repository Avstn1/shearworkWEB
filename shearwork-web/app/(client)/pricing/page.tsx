// app/pricing/page.tsx
'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js'
import { Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/utils/supabaseClient'
import { TRIAL_DAYS } from '@/lib/constants/trial'
import { useSearchParams, useRouter } from 'next/navigation'

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string,
)

type Plan = 'trial' | 'monthly' | 'yearly'

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
      <p className="mt-4 text-gray-300">Loading pricing...</p>
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
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [trialUsed, setTrialUsed] = useState(false)
  const [trialStatusLoading, setTrialStatusLoading] = useState(true)



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
          supabase.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token
          })
          
          setUserId(data.user.id)
          toast.success('Successfully authenticated!')
          
          // Reload to /pricing to ensure session is fully set
          setTimeout(() => {
            globalThis.location.href = '/pricing'
          }, 500)
          
        } else {
          // No code - check for existing web session
          const { data: { session } } = await supabase.auth.getSession()
          
          if (!session?.user) {
            toast.error('Please login to continue')
            router.push('/login')
            return
          }
          
          setUserId(session.user.id)
          setAuthenticating(false) // Only set false when not using code flow
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Authentication failed'
        console.error('Auth error:', message)
        toast.error(message)
        router.push('/login')
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
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Could not load pricing'
        console.error(message)
        toast.error(message)
      } finally {
        setLoadingPrices(false)
      }
    }

    fetchPricing()
  }, [userId])

  useEffect(() => {
    if (!userId) return

    const fetchTrialStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('trial_start, stripe_subscription_status')
          .eq('user_id', userId)
          .maybeSingle()

        if (error) throw error

        const status = data?.stripe_subscription_status ?? ''
        const hasUsedTrial = Boolean(data?.trial_start)
        const hasActiveSub = status === 'active' || status === 'trialing'
        setTrialUsed(hasUsedTrial || hasActiveSub)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load trial status'
        console.error(message)
      } finally {
        setTrialStatusLoading(false)
      }
    }

    fetchTrialStatus()
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
      setShowCancelModal(false)

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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not start checkout'
      console.error(message)
      toast.error(message)
      setSelectedPlan(null)
      setShowCancelModal(true)
    } finally {
      setLoading(false)
    }
  }

  const closeCheckout = (wasCanceled = true) => {
    setClientSecret(null)
    setSelectedPlan(null)
    if (wasCanceled) {
      setShowCancelModal(true)
    }
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
  const yearlyMonthlyEquivalent = yearly ? yearly.amount / 12 : null
  const showTrial = !trialStatusLoading && !trialUsed

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
        <div className={`grid grid-cols-1 ${showTrial ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
          {/* Trial plan */}
          {showTrial && (
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10 flex flex-col justify-between">
              <div>
                <h2 className="text-lg font-semibold mb-2">Corva Pro (Trial)</h2>

                {loadingPrices || !monthly ? (
                  <div className="flex items-center gap-2 text-gray-400 text-sm mb-6">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading price…</span>
                  </div>
                ) : (
                  <>
                    <p className="text-3xl font-bold mb-1">Free</p>
                    <p className="text-xs uppercase tracking-wide text-gray-400 mb-4">
                      {TRIAL_DAYS} days • billing info required
                    </p>
                    <p className="text-xs text-gray-300">
                      Start your {TRIAL_DAYS}-day free trial of Corva Pro. Enter billing info now — no commitment, cancel anytime.
                    </p>
                  </>
                )}

                <ul className="text-xs space-y-2 text-gray-200 mt-4">
                  <li>• Full revenue, expense & profit dashboards</li>
                  <li>• Weekly reports + analytics insights</li>
                  <li>• 10 SMS credits to try messaging</li>
                </ul>
              </div>

              <button
                onClick={() => startCheckout('trial')}
                disabled={loading || loadingPrices || !monthly}
                className="mt-4 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#7affc9] to-[#3af1f7] text-black font-semibold px-4 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading && selectedPlan === 'trial' && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {loading && selectedPlan === 'trial'
                  ? 'Starting checkout…'
                  : 'Start Free Trial'}
              </button>
            </div>
          )}

          {/* Monthly plan */}
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10 flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-semibold mb-2">Corva Pro (Monthly)</h2>

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
              <h2 className="text-lg font-semibold mb-2">Corva Pro (Yearly)</h2>

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
                  {yearlyMonthlyEquivalent && (
                    <p className="text-xs text-[#f5e29a] mb-4">
                      {formatAmount(yearlyMonthlyEquivalent, yearly.currency)} / month billed yearly
                    </p>
                  )}
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
          All payments are processed securely by Stripe. You can manage or cancel your subscription at any time.
        </p>

      </div>

      {/* Modal: embedded checkout */}
      {clientSecret && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="relative w-full max-w-xl bg-[#050608] border border-white/10 rounded-2xl p-4 md:p-6 shadow-2xl">
            <button
              onClick={() => closeCheckout(true)}
              className="absolute top-3 right-3 inline-flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition px-1.5 py-1.5"
              aria-label="Close checkout"
            >
              <X className="w-4 h-4 text-gray-200" />
            </button>

            <h2 className="text-sm font-semibold text-gray-100 mb-2">
              Secure checkout
              {selectedPlan === 'monthly' && ' • Monthly plan'}
              {selectedPlan === 'yearly' && ' • Yearly plan'}
              {selectedPlan === 'trial' && ' • Trial plan'}
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

      {showCancelModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b0f0e] p-6 text-white shadow-2xl">
            <h2 className="text-lg font-semibold mb-2">Checkout Canceled</h2>
            <p className="text-sm text-gray-300 mb-4">
              Your subscription was not completed. You have not been charged. You can return to our site to try again or choose a different plan.
            </p>
            <button
              onClick={() => {
                setShowCancelModal(false)
                router.push('/pricing')
              }}
              className="w-full rounded-xl bg-gradient-to-r from-[#7affc9] to-[#3af1f7] text-black font-semibold py-2"
            >
              Return to pricing
            </button>
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
