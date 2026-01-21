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
import EditableAvatar from '@/components/EditableAvatar'
import ConnectAcuityButton from '@/components/ConnectAcuityButton'
import ConnectSquareButton from '@/components/ConnectSquareButton'

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
const ROLE_OPTIONS = [
  { label: 'Barber (Commission)', role: 'Barber', barber_type: 'commission' },
  { label: 'Barber (Chair Rental)', role: 'Barber', barber_type: 'rental' },
]

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
  const [profileStepComplete, setProfileStepComplete] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)
  const [startTrial] = useState(true)
  const [fullName, setFullName] = useState('')
  const [selectedRole, setSelectedRole] = useState(ROLE_OPTIONS[0])
  const [commissionRate, setCommissionRate] = useState<number | ''>('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(undefined)
  const fileInputRef = useRef<HTMLInputElement>(null)



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

  const formatAmount = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(amount / 100)

  const startCheckout = async (plan: Plan) => {
    try {
      if (!profileStepComplete) {
        toast.error('Complete your profile to continue')
        return
      }

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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not start checkout'
      console.error(message)
      toast.error(message)
      setSelectedPlan(null)
    } finally {
      setLoading(false)
    }
  }

  const closeCheckout = () => {
    setClientSecret(null)
    setSelectedPlan(null)
  }

  const handleAvatarClick = () => fileInputRef.current?.click()

  const handleAvatarChange = (file: File) => {
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')

      let avatarUrl = ''
      if (avatarFile) {
        const fileName = `${fullName.replace(/\s+/g, '_')}_${Date.now()}`
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, avatarFile, { upsert: true })
        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName)
        avatarUrl = urlData.publicUrl
      }

      const profileUpdate: Record<string, unknown> = {
        full_name: fullName,
        role: selectedRole.role,
        barber_type: selectedRole.barber_type,
        avatar_url: avatarUrl,
        onboarded: true,
      }

      if (selectedRole.barber_type === 'commission') {
        if (commissionRate === '' || commissionRate < 1 || commissionRate > 100) {
          throw new Error('Please enter a valid commission rate between 1 and 100')
        }
        profileUpdate.commission_rate = commissionRate / 100
      }

      const { data: currentProfile, error: currentProfileError } = await supabase
        .from('profiles')
        .select('trial_start, available_credits')
        .eq('user_id', user.id)
        .single()

      if (currentProfileError) throw currentProfileError

      if (startTrial && !currentProfile?.trial_start) {
        const now = new Date()
        const trialEnd = new Date(now)
        trialEnd.setDate(trialEnd.getDate() + 7)

        profileUpdate.trial_start = now.toISOString()
        profileUpdate.trial_end = trialEnd.toISOString()
        profileUpdate.trial_active = true

        const existingCredits = currentProfile?.available_credits || 0
        profileUpdate.available_credits = existingCredits + 10
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('user_id', user.id)

      if (updateError) throw updateError

      setProfileStepComplete(true)
      toast.success('Profile saved')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save profile'
      console.error(message)
      toast.error(message)
    } finally {
      setProfileLoading(false)
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Trial plan */}
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
                    7 days • billing info required
                  </p>
                  <p className="text-xs text-gray-300">
                    Start your 7-day free trial of Corva Pro. Enter billing info now — no commitment, cancel anytime.
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

        {selectedPlan && (
          <div className="mt-8 border border-white/10 rounded-3xl bg-black/30 shadow-2xl p-6 md:p-8">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-lg font-semibold">Complete your profile</h2>
                <p className="text-xs text-gray-400">
                  We use this info to personalize your dashboard and reporting.
                </p>
              </div>
              {profileStepComplete && (
                <span className="text-xs text-emerald-300 border border-emerald-300/30 rounded-full px-3 py-1">
                  Profile saved
                </span>
              )}
            </div>

            <form onSubmit={handleProfileSave} className="mt-6 grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-6">
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-4">
                  <EditableAvatar
                    avatarUrl={avatarPreview}
                    fullName={fullName}
                    onClick={handleAvatarClick}
                    size={110}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => e.target.files?.[0] && handleAvatarChange(e.target.files[0])}
                  />
                </div>

                <div>
                  <label className="block mb-2 text-sm font-semibold text-white">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="w-full p-3 rounded-xl bg-black/60 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#3af1f7] transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block mb-2 text-sm font-semibold text-white">Role</label>
                  <select
                    value={selectedRole.label}
                    onChange={e => {
                      const roleObj = ROLE_OPTIONS.find(r => r.label === e.target.value)
                      if (roleObj) setSelectedRole(roleObj)
                    }}
                    className="w-full p-3 rounded-xl bg-black/60 border border-white/10 text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3af1f7] transition-all"
                  >
                    {ROLE_OPTIONS.map(r => (
                      <option key={r.label} value={r.label}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedRole.barber_type === 'commission' && (
                  <div>
                    <label className="block mb-2 text-sm font-semibold text-white">
                      Commission Rate (%) <span className="text-xs text-gray-400">(1 to 100)</span>
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max="100"
                      value={commissionRate}
                      onChange={e => setCommissionRate(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full p-3 rounded-xl bg-black/60 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#3af1f7] transition-all"
                      required
                    />
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="border border-white/10 rounded-2xl bg-black/40 p-4">
                  <h3 className="text-sm font-semibold text-white">Trial details</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Start your 7-day trial now. Billing info required. Cancel anytime.
                  </p>
                </div>

                <div className="border border-white/10 rounded-2xl bg-black/40 p-4">
                  <h3 className="text-sm font-semibold text-white">Connect your calendar</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Connect Acuity or Square now, or skip and do it later in settings.
                  </p>
                  <div className="mt-3 flex flex-col gap-2">
                    <ConnectAcuityButton />
                    <ConnectSquareButton />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-white/5 border border-white/10 text-white font-semibold rounded-xl hover:bg-white/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={profileLoading}
                >
                  {profileLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    'Save profile details'
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
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