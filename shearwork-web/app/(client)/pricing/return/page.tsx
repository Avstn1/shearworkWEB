'use client'

import { Suspense, useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
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
  const [userType, setUserType] = useState<'barber' | 'owner' | ''>('')
  const [selectedRole, setSelectedRole] = useState({
    label: '',
    role: '',
    barber_type: '',
  })
  const [commissionRate, setCommissionRate] = useState<number | ''>('')
  const [shopOperation, setShopOperation] = useState<'commission' | 'rental' | ''>('')
  const [username, setUsername] = useState('')
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [bookingLink, setBookingLink] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(undefined)
  const [selectedProvider, setSelectedProvider] = useState<'acuity' | 'square' | null>('acuity')
  const [showValidationErrors, setShowValidationErrors] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const usernameCheckTimeoutRef = useRef<NodeJS.Timeout>()

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
          .select('onboarded, full_name, role, barber_type, commission_rate, avatar_url, username, booking_link, trial_active, trial_start, trial_end')
          .eq('user_id', user.id)
          .single()

        if (error) throw error

        setProfile(data)
        setFullName(data?.full_name ?? '')
        setUsername(data?.username ?? '')
        setBookingLink(data?.booking_link ?? '')
        
        if (data?.role) {
          if (data.role === 'Barber') {
            setUserType('barber')
            if (data?.barber_type) {
              const label = data.barber_type === 'commission'
                ? 'Barber (Commission)'
                : 'Barber (Chair Rental)'
              setSelectedRole({ label, role: data.role, barber_type: data.barber_type })
            }
          } else if (data.role === 'Owner') {
            setUserType('owner')
            setSelectedRole({ label: 'Shop Owner / Manager', role: 'Owner', barber_type: '' })
            if (data?.barber_type) {
              setShopOperation(data.barber_type)
            }
          }
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

  const checkUsername = async (value: string) => {
    if (!value || value.length < 3) {
      setUsernameStatus('idle')
      return
    }

    setUsernameStatus('checking')

    try {
      const res = await fetch(`/api/db-search/search-username?username=${encodeURIComponent(value)}`)
      const data = await res.json()

      if (!res.ok) {
        setUsernameStatus('idle')
        return
      }

      setUsernameStatus(data.available ? 'available' : 'taken')
    } catch (err) {
      console.error('Username check error:', err)
      setUsernameStatus('idle')
    }
  }

  useEffect(() => {
    if (usernameCheckTimeoutRef.current) {
      clearTimeout(usernameCheckTimeoutRef.current)
    }

    if (username.length >= 3) {
      usernameCheckTimeoutRef.current = setTimeout(() => {
        checkUsername(username)
      }, 500)
    } else {
      setUsernameStatus('idle')
    }

    return () => {
      if (usernameCheckTimeoutRef.current) {
        clearTimeout(usernameCheckTimeoutRef.current)
      }
    }
  }, [username])

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

  const formatIsoDate = (value?: string | null) => {
    if (!value) return null
    return new Date(value).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const hasSub = summary?.hasSubscription ?? false
  const trialActive = isTrialActive(profile)
  const hasCheckoutComplete = sessionStatus === 'complete'
  const hasAccess = true // hasSub || trialActive || hasCheckoutComplete CHANGE LATER
  const calendarConnected = calendarStatus.acuity || calendarStatus.square
  const interval = summary?.price?.interval
  const intervalLabel =
    interval === 'year' ? 'yearly' : interval === 'month' ? 'monthly' : 'recurring'
  const amountText =
    summary?.price &&
    formatAmount(summary.price.amount, summary.price.currency)
  const endDateText = formatDate(summary?.current_period_end ?? null)
  const trialEndText = formatIsoDate(profile?.trial_end)

  const isCommissionValid =
    selectedRole.barber_type !== 'commission' ||
    (typeof commissionRate === 'number' && commissionRate >= 1 && commissionRate <= 100)
  
  const isShopOperationValid = 
    userType !== 'owner' || shopOperation !== ''
  
  const isUsernameValid = 
    username.trim().length >= 3 && usernameStatus === 'available'
  
  const isProfileValid = 
    fullName.trim().length > 0 && 
    userType !== '' && 
    (userType === 'owner' ? isShopOperationValid : selectedRole.barber_type !== '') &&
    isCommissionValid &&
    isUsernameValid

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

  useEffect(() => {
    if (calendarStatus.acuity) {
      setSelectedProvider('acuity')
      return
    }
    if (calendarStatus.square) {
      setSelectedProvider('square')
    }
  }, [calendarStatus.acuity, calendarStatus.square])

  const statusSummary = (() => {
    if (hasSub) {
      const renewalText = endDateText ? `Renews ${endDateText}` : 'Renews soon'
      const priceText = amountText ? `${amountText}/${interval === 'year' ? 'yr' : 'mo'}` : 'Plan active'
      return `Pro Plan Active · ${renewalText} · ${priceText}`
    }

    if (trialActive) {
      return `Free Trial Active · Ends ${trialEndText ?? 'in 7 days'}`
    }

    if (hasCheckoutComplete) {
      return 'Subscription processing · We will confirm shortly'
    }

    return null
  })()

  const stepLabels = ['Subscription', 'Profile', 'Calendar']
  const currentStep = !hasAccess ? 1 : !profile?.onboarded ? 2 : calendarConnected ? 3 : 3
  const providerConnected =
    selectedProvider === 'acuity'
      ? calendarStatus.acuity
      : selectedProvider === 'square'
        ? calendarStatus.square
        : false

  const handleAvatarClick = () => fileInputRef.current?.click()

  const handleAvatarChange = (file: File) => {
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isProfileValid) {
      setShowValidationErrors(true)
      return
    }
    
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
        barber_type: userType === 'owner' ? shopOperation : selectedRole.barber_type || null,
        avatar_url: avatarUrl,
        username: username.toLowerCase(),
        booking_link: bookingLink.trim() || null,
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

  const getTrustMessage = () => {
    if (userType === 'barber') {
      return 'You will only see your own schedule and data.'
    }
    if (userType === 'owner') {
      return 'For now, you will only see your own schedule and data. Full shop-wide analytics are coming soon.'
    }
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#101312] via-[#1a1f1b] to-[#2e3b2b] px-4 py-12">
      <div className="mx-auto w-full max-w-4xl lg:max-w-6xl text-white">
        <div className="text-center">
          <p className="text-[0.6rem] uppercase tracking-[0.35em] text-gray-400">Setup</p>
          <h1 className="mt-3 text-3xl font-semibold">Finish your onboarding</h1>
          <p className="mt-2 text-sm text-gray-400">
            Follow the steps below to unlock your dashboard and reports.
          </p>
          {hasAccess && (
            <div className="mt-5 flex flex-col items-center gap-3">
              <span className="text-xs text-emerald-200 border border-emerald-300/20 rounded-full px-3 py-1">
                Step {currentStep} of {stepLabels.length}
              </span>
              <div className="flex flex-wrap justify-center gap-2">
                {stepLabels.map((label, index) => (
                  <span
                    key={label}
                    className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                      index + 1 === currentStep
                        ? 'border-emerald-300/40 bg-emerald-400/10 text-emerald-100'
                        : 'border-white/10 bg-black/30 text-gray-400'
                    }`}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {statusSummary && (
          <div className="mt-6 flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs text-gray-200">
              <span className="text-emerald-300">✅</span>
              {statusSummary}
            </div>
          </div>
        )}

        <div className="mt-8 rounded-3xl border border-white/10 bg-black/30 p-6 md:p-8 shadow-2xl">
          {!hasAccess ? (
            <div className="space-y-4">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing your subscription…
                </div>
              ) : sessionStatus === 'open' ? (
                <>
                  <p className="text-lg font-semibold">Checkout not completed</p>
                  <p className="text-sm text-gray-300">
                    Please return to pricing to finish checkout and activate your plan.
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
                type="button"
                onClick={() => router.push('/pricing')}
                className="w-full rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                Return to pricing
              </button>
            </div>
          ) : (
            <div id={setupSectionId} className="space-y-8">
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

              <form onSubmit={handleProfileSave} className="space-y-8">
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Profile Section */}
                  <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-6">
                    <h3 className="text-sm font-semibold text-white uppercase tracking-[0.2em]">Your profile</h3>
                    
                    {/* Avatar and What best describes you Row */}
                    <div className="grid gap-4 md:grid-cols-[140px_1fr] items-center">
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

                      <div className="space-y-4">
                        <div>
                          <label className="block mb-2 text-sm font-semibold text-white">Full Name</label>
                          <input
                            type="text"
                            value={fullName}
                            onChange={e => setFullName(e.target.value)}
                            className="w-full p-3 rounded-xl bg-black/60 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#3af1f7] transition-all"
                            required
                          />
                          {showValidationErrors && !fullName.trim() && (
                            <p className="mt-1 text-xs text-rose-300">Enter your full name</p>
                          )}
                        </div>

                        <div>
                          <label className="block mb-2 text-sm font-semibold text-white">What best describes you?</label>
                          <select
                            value={userType}
                            onChange={e => {
                              const value = e.target.value as 'barber' | 'owner' | ''
                              setUserType(value)
                              if (value === 'barber') {
                                setSelectedRole({ label: '', role: 'Barber', barber_type: '' })
                                setShopOperation('')
                              } else if (value === 'owner') {
                                setSelectedRole({ label: 'Shop Owner / Manager', role: 'Owner', barber_type: '' })
                              } else {
                                setSelectedRole({ label: '', role: '', barber_type: '' })
                                setShopOperation('')
                              }
                            }}
                            className="w-full p-3 rounded-xl bg-black/60 border border-white/10 text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3af1f7] transition-all"
                          >
                            <option value="">Select...</option>
                            <option value="barber">Barber</option>
                            <option value="owner">Shop Owner / Manager</option>
                          </select>
                          {showValidationErrors && userType === '' && (
                            <p className="mt-1 text-xs text-rose-300">Select what best describes you</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Rest of the form fields */}
                    <div className="space-y-4">

                      {userType === 'barber' && (
                        <>
                          <div>
                            <label className="block mb-2 text-sm font-semibold text-white">How do you operate?</label>
                            <select
                              value={selectedRole.barber_type}
                              onChange={e => {
                                const barberType = e.target.value
                                setSelectedRole({
                                  label: barberType === 'commission' ? 'Barber (Commission)' : 'Barber (Chair Rental)',
                                  role: 'Barber',
                                  barber_type: barberType,
                                })
                              }}
                              className="w-full p-3 rounded-xl bg-black/60 border border-white/10 text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3af1f7] transition-all"
                            >
                              <option value="">Select...</option>
                              <option value="commission">Commission</option>
                              <option value="rental">Chair Rental</option>
                            </select>
                            {showValidationErrors && selectedRole.barber_type === '' && (
                              <p className="mt-1 text-xs text-rose-300">Select how you operate</p>
                            )}
                          </div>

                          {selectedRole.barber_type === 'commission' && (
                            <div>
                              <label className="block mb-2 text-sm font-semibold text-white">
                                Commission Rate (%)
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
                              <p className="mt-1 text-xs text-gray-400">
                                Used to calculate payouts and reports.
                              </p>
                              {showValidationErrors && !isCommissionValid && (
                                <p className="mt-1 text-xs text-rose-300">
                                  Enter a valid commission rate between 1 and 100
                                </p>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {userType === 'owner' && (
                        <div>
                          <label className="block mb-2 text-sm font-semibold text-white">How does your shop operate?</label>
                          <select
                            value={shopOperation}
                            onChange={e => setShopOperation(e.target.value as 'commission' | 'rental' | '')}
                            className="w-full p-3 rounded-xl bg-black/60 border border-white/10 text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3af1f7] transition-all"
                          >
                            <option value="">Select...</option>
                            <option value="commission">Commission</option>
                            <option value="rental">Chair Rental</option>
                          </select>
                          {showValidationErrors && shopOperation === '' && (
                            <p className="mt-1 text-xs text-rose-300">Select how your shop operates</p>
                          )}
                        </div>
                      )}

                      {userType && (
                        <div className="rounded-xl border border-blue-400/30 bg-blue-400/10 p-3">
                          <p className="text-xs text-blue-200">
                            {getTrustMessage()}
                          </p>
                        </div>
                      )}

                      <div>
                        <label className="block mb-2 text-sm font-semibold text-white">Booking Link (Optional)</label>
                        <input
                          type="url"
                          value={bookingLink}
                          onChange={e => setBookingLink(e.target.value)}
                          className="w-full p-3 rounded-xl bg-black/60 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#3af1f7] transition-all"
                          placeholder="https://your-booking-site.com"
                        />
                        <p className="mt-1 text-xs text-gray-400">
                          Where clients can book appointments with you directly
                        </p>
                        {!bookingLink.trim() && (
                          <p className="mt-1 text-xs text-amber-300">
                            ⚠️ SMS auto-nudges to clients are way more effective with a booking link.
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block mb-2 text-sm font-semibold text-white">Username</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={username}
                            onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                            className="w-full p-3 pr-10 rounded-xl bg-black/60 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#3af1f7] transition-all"
                            placeholder="yourname"
                            required
                          />
                          {usernameStatus === 'checking' && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-gray-400" />
                          )}
                          {usernameStatus === 'available' && (
                            <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-400" />
                          )}
                          {usernameStatus === 'taken' && (
                            <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-rose-400" />
                          )}
                        </div>
                        <p className="mt-1 text-xs text-gray-400">
                          Used for tracking SMS bookings: https://www.corva.ca/book?profile={username || 'yourname'}
                        </p>
                        {showValidationErrors && !username.trim() && (
                          <p className="mt-1 text-xs text-rose-300">Enter a username</p>
                        )}
                        {username.trim() && username.length < 3 && (
                          <p className="mt-1 text-xs text-rose-300">Username must be at least 3 characters</p>
                        )}
                        {usernameStatus === 'taken' && (
                          <p className="mt-1 text-xs text-rose-300">This username is already taken</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Calendar Section */}
                  <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-6">
                    <h3 className="text-sm font-semibold text-white uppercase tracking-[0.2em]">Connect your calendar</h3>
                    <p className="text-xs text-gray-400">
                      Choose the provider you want to sync. You can change this later in Settings.
                    </p>
                    <div className="space-y-3">
                      {(
                        [
                          {
                            id: 'acuity',
                            title: 'Acuity',
                            description: 'Recommended for booking management',
                            helper: 'Best if you manage appointments in Acuity Scheduling.',
                          },
                          {
                            id: 'square',
                            title: 'Square',
                            description: 'Best if you take payments + bookings in Square',
                            helper: 'Ideal if your POS and scheduling live in Square.',
                          },
                        ] as const
                      ).map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setSelectedProvider(option.id)}
                          className={`w-full rounded-2xl border p-4 text-left transition ${
                            selectedProvider === option.id
                              ? 'border-emerald-400/40 bg-emerald-400/10'
                              : 'border-white/10 bg-black/20 hover:border-white/30'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={`mt-1 h-4 w-4 rounded-full border ${
                                selectedProvider === option.id
                                  ? 'border-emerald-300 bg-emerald-300'
                                  : 'border-white/30'
                              }`}
                            />
                            <div>
                              <p className="text-sm font-semibold text-white">{option.title}</p>
                              <p className="text-xs text-gray-300">{option.description}</p>
                              <p className="text-[0.7rem] text-gray-400 mt-1">{option.helper}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>

                    {selectedProvider && (
                      <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                        <div className="flex flex-col gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {selectedProvider === 'acuity' ? 'Acuity selected' : 'Square selected'}
                            </p>
                            <p className="text-xs text-gray-400">
                              {providerConnected
                                ? 'Calendar connected successfully.'
                                : 'Connect to begin syncing appointments.'}
                            </p>
                          </div>
                          {!providerConnected && (
                            <div>
                              {selectedProvider === 'acuity' ? (
                                <ConnectAcuityButton
                                  variant="secondary"
                                  onBeforeConnect={handleBeforeConnectAcuity}
                                  disabled={calendarStatus.loading}
                                  disabledReason={calendarStatus.loading ? 'Checking calendar status' : undefined}
                                  className="w-full"
                                />
                              ) : (
                                <ConnectSquareButton
                                  variant="secondary"
                                  onBeforeConnect={handleBeforeConnectSquare}
                                  disabled={calendarStatus.loading}
                                  disabledReason={calendarStatus.loading ? 'Checking calendar status' : undefined}
                                  className="w-full"
                                />
                              )}
                            </div>
                          )}
                          {providerConnected && (
                            <span className="text-xs text-emerald-300 border border-emerald-300/30 rounded-full px-3 py-1 w-fit">
                              Connected
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <p className="text-[0.7rem] text-gray-500">
                      You can change this later in Settings.
                    </p>
                  </div>
                </div>

                {/* Centered Submit Section */}
                <div className="flex flex-col items-center space-y-3 max-w-md mx-auto">
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