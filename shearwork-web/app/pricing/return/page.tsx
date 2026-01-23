'use client'

import { Suspense, useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/utils/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import EditableAvatar from '@/components/EditableAvatar'
import ConnectAcuityButton from '@/components/ConnectAcuityButton'
import ConnectSquareButton from '@/components/ConnectSquareButton'
import { isTrialActive } from '@/utils/trial'

type BillingSummary = {
  hasSubscription: boolean
  cancel_at_period_end: boolean
  current_period_end?: number | null
  price?: {
    amount: number
    currency: string
    interval: string | null
    interval_count: number | null
  }
}

function PricingReturnContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { refreshProfile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<BillingSummary | null>(null)
  const [sessionStatus, setSessionStatus] = useState<'open' | 'complete' | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileStepComplete, setProfileStepComplete] = useState(false)
  const [calendarStatus, setCalendarStatus] = useState({
    acuity: false,
    square: false,
    loading: true,
  })
  const [profile, setProfile] = useState<{
    onboarded?: boolean | null
    trial_active?: boolean | null
    trial_start?: string | null
    trial_end?: string | null
  } | null>(null)
  const [fullName, setFullName] = useState('')
  const [selectedRole, setSelectedRole] = useState({
    label: 'Barber (Commission)',
    role: 'Barber',
    barber_type: 'commission',
  })
  const [commissionRate, setCommissionRate] = useState<number | ''>('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(undefined)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    console.log('Stripe session_id (for debugging):', sessionId)

    const fetchSummary = async () => {
      try {
        const summaryRequest = fetch('/api/stripe/billing-summary')
        const statusRequest = sessionId
          ? fetch(`/api/stripe/session-status?session_id=${sessionId}`)
          : null

        const [summaryRes, statusRes] = await Promise.all([
          summaryRequest,
          statusRequest,
        ])

        const summaryData = await summaryRes.json()
        if (!summaryRes.ok) {
          console.error('Failed to load billing summary on return page:', summaryData)
          setSummary(null)
        } else {
          setSummary(summaryData)
        }

        if (statusRes) {
          const statusData = await statusRes.json()
          if (!statusRes.ok) {
            console.error('Failed to load Stripe session status:', statusData)
          } else {
            setSessionStatus(statusData.status ?? null)
          }
        } else {
          setSessionStatus(null)
        }
      } catch (err) {
        console.error('Error loading billing summary on return page:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchSummary()
  }, [searchParams])

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase
          .from('profiles')
          .select('onboarded, full_name, role, barber_type, commission_rate, avatar_url, trial_active, trial_start, trial_end')
          .eq('user_id', user.id)
          .single()

        if (error) throw error

        setProfile(data)
        setFullName(data?.full_name ?? '')
        if (data?.role && data?.barber_type) {
          const label = data.barber_type === 'commission'
            ? 'Barber (Commission)'
            : 'Barber (Chair Rental)'
          setSelectedRole({ label, role: data.role, barber_type: data.barber_type })
        }
        if (typeof data?.commission_rate === 'number') {
          setCommissionRate(Math.round(data.commission_rate * 100))
        }
        if (data?.avatar_url) {
          setAvatarPreview(data.avatar_url)
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load profile'
        console.error(message)
      }
    }

    fetchProfile()
  }, [])

  const formatAmount = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(amount / 100)

  const formatDate = (ts?: number | null) => {
    if (!ts) return null
    return new Date(ts * 1000).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const hasSub = summary?.hasSubscription ?? false
  const trialActive = isTrialActive(profile)
  const hasCheckoutComplete = sessionStatus === 'complete'
  const hasAccess = hasSub || trialActive || hasCheckoutComplete
  const calendarConnected = calendarStatus.acuity || calendarStatus.square
  const interval = summary?.price?.interval
  const intervalLabel =
    interval === 'year' ? 'yearly' : interval === 'month' ? 'monthly' : 'recurring'
  const amountText =
    summary?.price &&
    formatAmount(summary.price.amount, summary.price.currency)
  const endDateText = formatDate(summary?.current_period_end ?? null)

  const isCommissionValid =
    selectedRole.barber_type !== 'commission' ||
    (typeof commissionRate === 'number' && commissionRate >= 1 && commissionRate <= 100)
  const isProfileValid = fullName.trim().length > 0 && isCommissionValid

  const setupSectionId = 'onboarding-setup'

  const scrollToSetup = () => {
    document.getElementById(setupSectionId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  const fetchCalendarStatus = async () => {
    try {
      const [acuityRes, squareRes] = await Promise.all([
        fetch('/api/acuity/status', { cache: 'no-store' }),
        fetch('/api/square/status', { cache: 'no-store' }),
      ])

      const acuityData = acuityRes.ok ? await acuityRes.json() : null
      const squareData = squareRes.ok ? await squareRes.json() : null

      setCalendarStatus({
        acuity: Boolean(acuityData?.connected),
        square: Boolean(squareData?.connected),
        loading: false,
      })
    } catch (error) {
      console.error('Calendar status error:', error)
      setCalendarStatus({ acuity: false, square: false, loading: false })
    }
  }

  useEffect(() => {
    fetchCalendarStatus()
  }, [])

  const handleBeforeConnectAcuity = async () => {
    if (calendarStatus.square) {
      const toastId = toast.loading('Disconnecting Square...')
      const res = await fetch('/api/square/disconnect', { method: 'POST' })
      if (!res.ok) {
        toast.error('Failed to disconnect Square', { id: toastId })
        return false
      }
      toast.success('Square disconnected', { id: toastId })
      setCalendarStatus(prev => ({ ...prev, square: false }))
    }
    return true
  }

  const handleBeforeConnectSquare = async () => {
    if (calendarStatus.acuity) {
      const toastId = toast.loading('Disconnecting Acuity...')
      const res = await fetch('/api/acuity/disconnect', { method: 'POST' })
      if (!res.ok) {
        toast.error('Failed to disconnect Acuity', { id: toastId })
        return false
      }
      toast.success('Acuity disconnected', { id: toastId })
      setCalendarStatus(prev => ({ ...prev, acuity: false }))
    }
    return true
  }

  const steps = [
    { label: 'Subscription', complete: hasAccess },
    { label: 'Profile', complete: Boolean(profile?.onboarded || profileStepComplete) },
    { label: 'Calendar', complete: calendarConnected },
  ]
  const completedSteps = steps.filter(step => step.complete).length
  const connectedProvider = calendarStatus.acuity
    ? 'Acuity'
    : calendarStatus.square
      ? 'Square'
      : null

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

      let avatarUrl = avatarPreview || ''
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
        .select('trial_start, available_credits, reserved_credits')
        .eq('user_id', user.id)
        .single()

      if (currentProfileError) throw currentProfileError

      if (!currentProfile?.trial_start) {
        const now = new Date()
        const trialEnd = new Date(now)
        trialEnd.setDate(trialEnd.getDate() + 7)

        profileUpdate.trial_start = now.toISOString()
        profileUpdate.trial_end = trialEnd.toISOString()
        profileUpdate.trial_active = true
      }

      const { data: trialBonus } = await supabase
        .from('credit_transactions')
        .select('id')
        .eq('user_id', user.id)
        .eq('action', 'trial_bonus')
        .maybeSingle()

      const existingCredits = currentProfile?.available_credits || 0
      const existingReserved = currentProfile?.reserved_credits || 0
      const shouldGrantTrialCredits = !trialBonus
      const trialCreditAmount = 10

      if (shouldGrantTrialCredits) {
        profileUpdate.available_credits = existingCredits + trialCreditAmount
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('user_id', user.id)

      if (updateError) throw updateError

      if (shouldGrantTrialCredits) {
        const { error: creditError } = await supabase
          .from('credit_transactions')
          .insert({
            user_id: user.id,
            action: 'trial_bonus',
            old_available: existingCredits,
            new_available: existingCredits + trialCreditAmount,
            old_reserved: existingReserved,
            new_reserved: existingReserved,
            created_at: new Date().toISOString(),
          })

        if (creditError) {
          console.error('Failed to log trial credits:', creditError)
        }
      }

      setProfileStepComplete(true)
      setProfile(prev => (prev ? { ...prev, onboarded: true } : prev))
      toast.success('Profile saved')
      await refreshProfile()
      router.push('/dashboard')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save profile'
      console.error(message)
      toast.error(message)
    } finally {
      setProfileLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#101312] via-[#1a1f1b] to-[#2e3b2b] px-4 py-10">
      <div className="mx-auto w-full max-w-5xl text-white space-y-6">
        <div className="rounded-3xl border border-white/10 bg-black/40 p-5 md:p-6 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[0.6rem] uppercase tracking-[0.3em] text-gray-400">Setup progress</p>
              <h1 className="mt-2 text-2xl font-semibold">Welcome to Corva Pro</h1>
              <p className="text-xs text-gray-400">
                Complete the steps below to unlock your dashboard.
              </p>
            </div>
            <span className="text-xs text-emerald-200 border border-emerald-300/20 rounded-full px-3 py-1">
              {completedSteps} of {steps.length} complete
            </span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {steps.map((step, index) => (
              <div
                key={step.label}
                className={`rounded-2xl border px-4 py-3 ${
                  step.complete
                    ? 'border-emerald-400/40 bg-emerald-400/10'
                    : 'border-white/10 bg-black/30'
                }`}
              >
                <p className="text-[0.65rem] uppercase text-gray-400">Step {index + 1}</p>
                <p className="mt-1 text-sm font-semibold text-white">{step.label}</p>
                <p className="text-[0.65rem] text-gray-400">
                  {step.complete ? 'Complete' : 'Pending'}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
          <div className="rounded-3xl border border-white/10 bg-black/30 p-6 shadow-2xl">
            <h2 className="text-lg font-semibold">Subscription status</h2>
            <div className="mt-4 space-y-3">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing your subscription…
                </div>
              ) : hasSub || hasCheckoutComplete ? (
                <>
                  <p className="text-base font-semibold">Thanks for subscribing 🎉</p>
                  {hasSub ? (
                    <>
                      <p className="text-sm text-gray-300">
                        You&apos;re on the <span className="font-semibold">Corva Pro</span>{' '}
                        <span className="font-semibold">{intervalLabel}</span> plan.
                      </p>
                      <p className="text-sm text-gray-300">
                        Current period ends on{' '}
                        <span className="font-semibold">
                          {endDateText ?? 'the current billing period end date'}
                        </span>
                        .
                      </p>
                      <p className="text-sm text-gray-400">
                        You&apos;ll be charged{' '}
                        <span className="font-semibold">
                          {amountText ?? 'your plan price'}
                        </span>{' '}
                        per {interval === 'year' ? 'year' : 'month'} unless you cancel.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-300">
                      Your subscription is processing. This page will update once Stripe confirms the payment.
                    </p>
                  )}
                </>
              ) : trialActive ? (
                <>
                  <p className="text-base font-semibold">Your free trial is active 🎉</p>
                  <p className="text-sm text-gray-300">
                    Complete your profile to start using Corva Pro and connect your calendar.
                  </p>
                </>
              ) : sessionStatus === 'open' ? (
                <>
                  <p className="text-base font-semibold">Checkout not completed</p>
                  <p className="text-sm text-gray-300">
                    Please return to pricing to finish checkout and activate your plan.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-base font-semibold">No active subscription</p>
                  <p className="text-sm text-gray-300">
                    We couldn&apos;t find an active subscription for this account. Please return to pricing to choose a plan.
                  </p>
                </>
              )}
            </div>

            {hasAccess && !profile?.onboarded && (
              <button
                type="button"
                onClick={scrollToSetup}
                className="mt-5 w-full rounded-xl bg-gradient-to-r from-[#7affc9] to-[#3af1f7] px-4 py-2 text-sm font-semibold text-black"
              >
                Continue setup
              </button>
            )}

            {!hasAccess && (
              <button
                type="button"
                onClick={() => router.push('/pricing')}
                className="mt-5 w-full rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                Return to pricing
              </button>
            )}
          </div>

          {!loading && hasAccess && !profile?.onboarded && (
            <div id={setupSectionId} className="rounded-3xl border border-white/10 bg-black/30 shadow-2xl p-6 md:p-8">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-lg font-semibold">Complete your setup</h2>
                  <p className="text-xs text-gray-400">
                    Finish your profile and connect a calendar to get started.
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
                  <div className="flex flex-col items-center gap-3">
                    <EditableAvatar
                      avatarUrl={avatarPreview}
                      fullName={fullName}
                      onClick={handleAvatarClick}
                      size={110}
                    />
                    <button
                      type="button"
                      onClick={handleAvatarClick}
                      className="text-xs font-semibold text-[#cbd5f5] border border-white/10 rounded-full px-4 py-1 hover:border-white/20"
                    >
                      Change photo
                    </button>
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
                        const roleObj = ['Barber (Commission)', 'Barber (Chair Rental)'].includes(e.target.value)
                          ? e.target.value
                          : 'Barber (Commission)'

                        setSelectedRole({
                          label: roleObj,
                          role: 'Barber',
                          barber_type: roleObj === 'Barber (Commission)' ? 'commission' : 'rental',
                        })
                      }}
                      className="w-full p-3 rounded-xl bg-black/60 border border-white/10 text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3af1f7] transition-all"
                    >
                      <option value="Barber (Commission)">Barber (Commission)</option>
                      <option value="Barber (Chair Rental)">Barber (Chair Rental)</option>
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
                      {!isCommissionValid && (
                        <p className="mt-1 text-xs text-rose-300">
                          Enter a commission rate between 1 and 100.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="border border-white/10 rounded-2xl bg-black/40 p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">Choose a calendar provider</h3>
                      {connectedProvider && (
                        <span className="text-[0.7rem] text-emerald-300 border border-emerald-300/30 rounded-full px-2 py-0.5">
                          Connected: {connectedProvider}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Only one provider can be active at a time. Connecting one will disconnect the other.
                    </p>
                    <p className="text-[0.7rem] text-gray-500 mt-1">
                      We use this to sync appointments and populate your reports.
                    </p>
                    <div className="mt-3 flex flex-col gap-3">
                      <div className={`rounded-xl border p-4 ${calendarStatus.acuity ? 'border-emerald-400/40 bg-emerald-400/10' : 'border-white/10 bg-black/20'}`}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-white">Acuity</p>
                            <p className="text-xs text-gray-400">Best if you manage bookings in Acuity Scheduling.</p>
                          </div>
                          <ConnectAcuityButton
                            onBeforeConnect={handleBeforeConnectAcuity}
                            disabled={calendarStatus.loading}
                            disabledReason={calendarStatus.loading ? 'Checking calendar status' : undefined}
                            className="w-full sm:w-auto"
                          />
                        </div>
                      </div>
                      <div className={`rounded-xl border p-4 ${calendarStatus.square ? 'border-emerald-400/40 bg-emerald-400/10' : 'border-white/10 bg-black/20'}`}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-white">Square</p>
                            <p className="text-xs text-gray-400">Best if you manage payments and bookings in Square.</p>
                          </div>
                          <ConnectSquareButton
                            onBeforeConnect={handleBeforeConnectSquare}
                            disabled={calendarStatus.loading}
                            disabledReason={calendarStatus.loading ? 'Checking calendar status' : undefined}
                            className="w-full sm:w-auto"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className={`w-full py-3 font-semibold rounded-xl transition-all ${
                      isProfileValid && !profileLoading
                        ? 'bg-gradient-to-r from-[#7affc9] to-[#3af1f7] text-black'
                        : 'bg-white/5 border border-white/10 text-gray-400'
                    }`}
                    disabled={profileLoading || !isProfileValid}
                  >
                    {profileLoading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </span>
                    ) : (
                      'Finish onboarding'
                    )}
                  </button>
                  {!isProfileValid && (
                    <p className="text-xs text-gray-400">
                      Enter your name and a valid commission rate to continue.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      toast('Connect a calendar later in Settings to sync appointments.', {
                        icon: '⚠️',
                      })
                      router.push('/settings')
                    }}
                    className="w-full py-2 text-xs text-gray-400 hover:text-white transition"
                  >
                    Connect later in Settings
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PricingReturnPage() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <PricingReturnContent />
    </Suspense>
  )
}
