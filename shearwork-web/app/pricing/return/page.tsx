'use client'

import { Suspense, useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/utils/supabaseClient'
import EditableAvatar from '@/components/EditableAvatar'
import ConnectAcuityButton from '@/components/ConnectAcuityButton'
import ConnectSquareButton from '@/components/ConnectSquareButton'

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
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<BillingSummary | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileStepComplete, setProfileStepComplete] = useState(false)
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
        const res = await fetch('/api/stripe/billing-summary')
        const data = await res.json()
        if (!res.ok) {
          console.error('Failed to load billing summary on return page:', data)
          setSummary(null)
        } else {
          setSummary(data)
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

  const isTrialProfileActive = (profileData?: {
    trial_active?: boolean | null
    trial_start?: string | null
    trial_end?: string | null
  } | null) => {
    if (!profileData?.trial_active || !profileData.trial_start || !profileData.trial_end) return false
    const start = new Date(profileData.trial_start)
    const end = new Date(profileData.trial_end)
    const now = new Date()
    return now >= start && now <= end
  }

  const hasSub = summary?.hasSubscription ?? false
  const isTrialActive = isTrialProfileActive(profile)
  const hasAccess = hasSub || isTrialActive
  const interval = summary?.price?.interval
  const intervalLabel =
    interval === 'year' ? 'yearly' : interval === 'month' ? 'monthly' : 'recurring'
  const amountText =
    summary?.price &&
    formatAmount(summary.price.amount, summary.price.currency)
  const endDateText = formatDate(summary?.current_period_end ?? null)

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
        .select('trial_start, available_credits')
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#101312] via-[#1a1f1b] to-[#2e3b2b] px-4">
      <div className="w-full max-w-3xl text-white">
        <div className="w-full text-center space-y-4 bg-black/30 border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
        {loading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-sm text-gray-300">
              Processing your subscription…
            </p>
          </div>
        ) : hasSub ? (
          <>
            <p className="text-lg font-semibold">Thanks for subscribing 🎉</p>
            <p className="text-sm text-gray-300">
              You&apos;re now on the{' '}
              <span className="font-semibold">Corva Pro</span>{' '}
              <span className="font-semibold">{intervalLabel}</span> plan.
            </p>
            <p className="text-sm text-gray-300">
              Your current period ends on{' '}
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
        ) : isTrialActive ? (
          <>
            <p className="text-lg font-semibold">Your free trial is active 🎉</p>
            <p className="text-sm text-gray-300">
              Complete your profile to start using Corva Pro and connect your calendar.
            </p>
          </>
        ) : (
          <>
            <p className="text-lg font-semibold">No active subscription</p>
            <p className="text-sm text-gray-300">
              We couldn&apos;t find an active subscription for this account. Please return to pricing to choose a plan.
            </p>
          </>
        )}

        <button
          onClick={() => router.push(hasAccess ? '/dashboard' : '/pricing')}
          className="mt-2 inline-flex items-center justify-center px-4 py-2 rounded-xl bg-gradient-to-r from-[#7affc9] to-[#3af1f7] text-black text-sm font-semibold w-full"
        >
          {hasAccess ? 'Go to dashboard' : 'Return to pricing'}
        </button>

        </div>

        {!loading && hasAccess && !profile?.onboarded && (
          <div className="mt-8 border border-white/10 rounded-3xl bg-black/30 shadow-2xl p-6 md:p-8">
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
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="border border-white/10 rounded-2xl bg-black/40 p-4">
                  <h3 className="text-sm font-semibold text-white">Connect your calendar</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Connect Square or Acuity now, or skip and do it later in settings.
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
                    'Finish onboarding'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    toast('Connect a calendar in Settings to sync appointments.', {
                      icon: '⚠️',
                    })
                    router.push('/settings')
                  }}
                  className="w-full py-2 text-xs text-gray-400 hover:text-white transition"
                >
                  Skip for now
                </button>
              </div>
            </form>
          </div>
        )}
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
