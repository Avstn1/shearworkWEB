// app/pricing/page.tsx
'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js'
import { Loader2, X, Check, Zap, Crown } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/utils/supabaseClient'
import { TRIAL_DAYS } from '@/lib/constants/trial'
import { useSearchParams, useRouter } from 'next/navigation'
import { isValidUUID } from '@/utils/validation'

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

// Feature list for each plan - must match actual functionality
const FEATURES = {
  trial: [
    'Auto-Fill your empty slots',
    'Smart booking reminders to past clients',
    'Real-time booking alerts',
    'Weekly performance insights',
  ],
  pro: [
    'Everything in trial',
    'Full analytics dashboard',
    'Revenue & profit tracking',
    'Priority support',
  ],
  proYearly: [
    'Everything in Monthly',
    'Save CA$20/year',
    'Locked-in annual price',
  ],
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
        console.log('Fetched pricing:', res.status, data)

        if (!res.ok) {
          throw new Error(data.error || 'Failed to load pricing')
        }

        setPricing(data)
      } catch (err: any) {
        const message = err.message || 'Failed to load pricing'
        console.error("error: " + message)
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
      // Validate userId before querying database
      if (!isValidUUID(userId)) {
        console.error('Invalid userId format:', userId)
        toast.error('Session error. Please login again.')
        router.push('/login')
        return
      }

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
  }, [userId, router])

  const formatAmount = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(amount / 100)

  // Start card-less trial (no Stripe checkout)
  const startTrial = async () => {
    try {
      setLoading(true)
      setSelectedPlan('trial')
      setShowCancelModal(false)

      const res = await fetch('/api/trial/start', {
        method: 'POST',
      })

      const data = await res.json()
      console.log('trial/start response:', res.status, data)

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start trial')
      }

      toast.success('Trial started! Redirecting to onboarding...')
      router.push('/pricing/return')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not start trial'
      console.error(message)
      toast.error(message)
      setSelectedPlan(null)
      setShowCancelModal(true)
    } finally {
      setLoading(false)
    }
  }

  // Start Stripe checkout for paid plans
  const startCheckout = async (plan: Plan) => {
    // For trial, use the card-less flow
    if (plan === 'trial') {
      return startTrial()
    }

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
  const showTrial = !trialStatusLoading && !trialUsed
  
  // Calculate savings: monthly * 12 - yearly
  const yearlySavings = monthly && yearly ? (monthly.amount * 12) - yearly.amount : null

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#181818] px-4 pt-20 sm:pt-24 pb-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
          Pick a plan
        </h1>
        <p className="text-sm text-gray-400">
          Fill empty chairs. Bring back clients. Make more money.
        </p>
      </div>

      {/* Plans */}
      <div className={`flex flex-col lg:flex-row gap-5 w-full max-w-4xl ${showTrial ? '' : 'lg:max-w-2xl'}`}>
        
        {/* Trial */}
        {showTrial && (
          <div className="flex-1 bg-[#1a1a1a] rounded-2xl p-6 border border-[#2a2a2a]">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-5 w-5 text-[#73aa57]" />
              <h2 className="text-lg font-semibold text-white">Free Trial</h2>
            </div>
            
            <div className="mb-1">
              <span className="text-4xl font-bold text-white">$0</span>
            </div>
            <p className="text-sm text-gray-500 mb-6.5">{TRIAL_DAYS} days • No card required <br/> Takes 2 minutes to set up</p>

            <button
              onClick={() => startCheckout('trial')}
              disabled={loading || loadingPrices}
              className="w-full rounded-xl bg-[#2a2a2a] hover:bg-[#333] text-white font-semibold py-3 text-sm transition-colors disabled:opacity-50 mb-5"
            >
              {loading && selectedPlan === 'trial' ? (
                <Loader2 className="h-4 w-4 mx-auto animate-spin" />
              ) : (
                'Start free trial'
              )}
            </button>

            <ul className="space-y-3">
              {FEATURES.trial.map((feature, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="h-4 w-4 text-[#73aa57] flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Pro Yearly - Featured */}
        <div className="flex-1 bg-[#1a1a1a] rounded-2xl p-6 border-2 border-[#73aa57]/50 relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="bg-[#73aa57] text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
              <Crown className="h-3 w-3" />
              Best Value
            </span>
          </div>
          
          <div className="flex items-center gap-2 mb-4 mt-1">
            <h2 className="text-lg font-semibold text-white">Pro Yearly</h2>
          </div>
          
          <div className="mb-1">
            {loadingPrices || !yearly ? (
              <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
            ) : (
              <span className="text-4xl font-bold text-white">
                {formatAmount(yearly.amount, yearly.currency)}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mb-1">per year</p>
          {yearlySavings && yearlySavings > 0 && (
            <p className="text-sm text-[#73aa57] font-medium mb-4">
              Save {formatAmount(yearlySavings, yearly?.currency || 'usd')} vs monthly
            </p>
          )}
          {!yearlySavings && <div className="mb-4" />}

          <button
            onClick={() => startCheckout('yearly')}
            disabled={loading || loadingPrices || !yearly}
            className="w-full rounded-xl bg-[#73aa57] hover:bg-[#5b8f52] text-white font-semibold py-3 text-sm transition-colors disabled:opacity-50 mb-5"
          >
            {loading && selectedPlan === 'yearly' ? (
              <Loader2 className="h-4 w-4 mx-auto animate-spin" />
            ) : (
              'Subscribe Yearly'
            )}
          </button>

          <ul className="space-y-3">
            {FEATURES.proYearly.map((feature, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-gray-300">
                <Check className="h-4 w-4 text-[#73aa57] flex-shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* Pro Monthly */}
        <div className="flex-1 bg-[#1a1a1a] rounded-2xl p-6 border border-[#2a2a2a]">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold text-white">Pro Monthly</h2>
          </div>
          
          <div className="mb-1">
            {loadingPrices || !monthly ? (
              <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
            ) : (
              <span className="text-4xl font-bold text-white">
                {formatAmount(monthly.amount, monthly.currency)}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mb-11">per month</p>

          <button
            onClick={() => startCheckout('monthly')}
            disabled={loading || loadingPrices || !monthly}
            className="w-full rounded-xl bg-[#2a2a2a] hover:bg-[#333] text-white font-semibold py-3 text-sm transition-colors disabled:opacity-50 mb-5"
          >
            {loading && selectedPlan === 'monthly' ? (
              <Loader2 className="h-4 w-4 mx-auto animate-spin" />
            ) : (
              'Subscribe Monthly'
            )}
          </button>

          <ul className="space-y-3">
            {FEATURES.pro.map((feature, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-gray-300">
                <Check className="h-4 w-4 text-[#73aa57] flex-shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-6 text-xs text-gray-500">
        Cancel anytime • Secure checkout by Stripe
      </p>

      {/* Modal: embedded checkout */}
      {clientSecret && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 overflow-y-auto">
          <div className="relative w-full max-w-xl bg-[#050608] border border-white/10 rounded-2xl p-4 md:p-6 shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => closeCheckout(true)}
              className="absolute top-3 right-3 inline-flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition px-1.5 py-1.5 z-10"
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

      {/* Logout button */}
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
