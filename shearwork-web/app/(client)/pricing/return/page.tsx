'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { AnimatePresence, motion, Variants, easeInOut } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '@/utils/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import ProfileStep from '@/components/Onboarding/ProfileStep'
import CalendarStep from '@/components/Onboarding/CalendarStep'
import BookingSyncStep from '@/components/Onboarding/BookingSyncStep'
import AutoNudgeActivationStep from '@/components/Onboarding/AutoNudgeActivationStep'
import { isTrialActive } from '@/utils/trial'

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: easeInOut },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: { duration: 0.3, ease: easeInOut },
  },
}

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
  
  // State
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<BillingSummary | null>(null)
  const [sessionStatus, setSessionStatus] = useState<'open' | 'complete' | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileStepComplete, setProfileStepComplete] = useState(false)
  const [currentOnboardingStep, setCurrentOnboardingStep] = useState<'profile' | 'calendar' | 'booking-sync' | 'auto-nudge'>('profile')
  const [showValidationErrors, setShowValidationErrors] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  // Calendar state
  const [calendarStatus, setCalendarStatus] = useState({
    acuity: false,
    square: false,
    loading: true,
  })
  const [acuityCalendars, setAcuityCalendars] = useState<Array<{ id: number | string; name: string }>>([])
  const [selectedAcuityCalendar, setSelectedAcuityCalendar] = useState<string>('')
  const [selectedProvider, setSelectedProvider] = useState<'acuity' | 'square' | null>('acuity')
  
  // Profile state
  const [profile, setProfile] = useState<{
    onboarded?: boolean | null
    trial_active?: boolean | null
    trial_start?: string | null
    trial_end?: string | null
  } | null>(null)
  const [fullName, setFullName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [userType, setUserType] = useState<'barber' | 'owner' | ''>('')
  const [selectedRole, setSelectedRole] = useState({
    label: '',
    role: '',
    barber_type: '',
  })
  const [commissionRate, setCommissionRate] = useState<number | ''>('')
  const [username, setUsername] = useState('')
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [bookingLink, setBookingLink] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(undefined)

  // Load billing summary
  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    
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

  // Load profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase
          .from('profiles')
          .select('onboarded, full_name, phone, role, barber_type, commission_rate, avatar_url, username, booking_link, trial_active, trial_start, trial_end')
          .eq('user_id', user.id)
          .single()

        if (error) throw error

        setProfile(data)
        setFullName(data?.full_name ?? '')
        
        // Format phone from E.164 (+12223334444) to display format (222) 333-4444
        const phoneFromDB = data?.phone ?? ''
        if (phoneFromDB) {
          const phoneDigits = phoneFromDB.replace(/\D/g, '').slice(1) // Remove +1, keep 10 digits
          const formatPhoneDisplay = (digits: string) => {
            if (digits.length <= 3) {
              return digits
            } else if (digits.length <= 6) {
              return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
            } else {
              return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
            }
          }
          setPhoneNumber(formatPhoneDisplay(phoneDigits))
        } else {
          setPhoneNumber('')
        }
        
        setUsername(data?.username ?? '')
        setBookingLink(data?.booking_link ?? '')
        
        if (data?.role) {
          if (data.role === 'Barber') {
            setUserType('barber')
            if (data?.barber_type) {
              const label = data.barber_type === 'commission' ? 'Commission' : 'Chair Rental'
              setSelectedRole({ label, role: data.role, barber_type: data.barber_type })
            }
          } else if (data.role === 'Owner') {
            setUserType('owner')
            setSelectedRole({ label: 'Shop Owner / Manager', role: 'Owner', barber_type: data.barber_type || '' })
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

  // Load calendar status
  const fetchCalendarStatus = async () => {
    try {
      const [acuityRes, squareRes] = await Promise.all([
        fetch('/api/acuity/status', { cache: 'no-store' }),
        fetch('/api/square/status', { cache: 'no-store' }),
      ])

      const acuityData = acuityRes.ok ? await acuityRes.json() : null
      const squareData = squareRes.ok ? await squareRes.json() : null

      const acuityConnected = Boolean(acuityData?.connected)
      const squareConnected = Boolean(squareData?.connected)

      setCalendarStatus({
        acuity: acuityConnected,
        square: squareConnected,
        loading: false,
      })

      if (acuityConnected) {
        const calRes = await fetch('/api/acuity/calendar')
        if (calRes.ok) {
          const calData = await calRes.json()
          setAcuityCalendars(calData.calendars || [])
        }
      } else {
        setAcuityCalendars([])
        setSelectedAcuityCalendar('')
      }
    } catch (error) {
      console.error('Calendar status error:', error)
      setCalendarStatus({ acuity: false, square: false, loading: false })
    }
  }

  useEffect(() => {
    fetchCalendarStatus()
  }, [])

  useEffect(() => {
    if (calendarStatus.acuity) {
      setSelectedProvider('acuity')
      return
    }
    if (calendarStatus.square) {
      setSelectedProvider('square')
    }
  }, [calendarStatus.acuity, calendarStatus.square])

  // Handlers
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

  const handleAcuityConnectSuccess = async () => {
    await fetchCalendarStatus()
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

  const phoneToE164 = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '')
    return `+1${cleaned}`
  }

  const handleNext = () => {
    if (currentOnboardingStep === 'profile') {
      if (!isProfileValid) {
        setShowValidationErrors(true)
        return
      }
      setShowValidationErrors(false)
      setCurrentOnboardingStep('calendar')
    } else if (currentOnboardingStep === 'calendar') {
      setCurrentOnboardingStep('booking-sync')
    } else if (currentOnboardingStep === 'booking-sync') {
      setCurrentOnboardingStep('auto-nudge')
    }
  }

  const handleBack = () => {
    if (currentOnboardingStep === 'calendar') {
      setCurrentOnboardingStep('profile')
    } else if (currentOnboardingStep === 'booking-sync') {
      setCurrentOnboardingStep('calendar')
    } else if (currentOnboardingStep === 'auto-nudge') {
      setCurrentOnboardingStep('booking-sync')
    }
  }

  const handleSaveCalendar = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')

      const { error } = await supabase
        .from('profiles')
        .update({
          calendar: selectedProvider === 'acuity' ? selectedAcuityCalendar : null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)

      if (error) throw error
      toast.success('Calendar saved!')
    } catch (error) {
      console.error('Error saving calendar:', error)
      toast.error('Failed to save calendar')
      throw error
    }
  }

  const handleFinishOnboarding = async () => {
    if (!isCalendarConnected) {
      toast.error('Please connect a calendar to continue')
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
        phone: phoneToE164(phoneNumber),
        role: selectedRole.role,
        barber_type: selectedRole.barber_type || null,
        avatar_url: avatarUrl,
        username: username.toLowerCase(),
        booking_link: bookingLink.trim(),
        calendar: selectedProvider === 'acuity' ? selectedAcuityCalendar : null,
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
      toast.success('Onboarding complete!')
      await refreshProfile()
      router.push('/dashboard')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to complete onboarding'
      console.error(message)
      toast.error(message)
    } finally {
      setProfileLoading(false)
    }
  }

  // Computed values
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
  const hasAccess = hasSub || trialActive || hasCheckoutComplete 
  const calendarConnected = calendarStatus.acuity || calendarStatus.square
  const interval = summary?.price?.interval
  const amountText = summary?.price && formatAmount(summary.price.amount, summary.price.currency)
  const endDateText = formatDate(summary?.current_period_end ?? null)
  const trialEndText = formatIsoDate(profile?.trial_end)

  const isCommissionValid =
    selectedRole.barber_type !== 'commission' ||
    (typeof commissionRate === 'number' && commissionRate >= 1 && commissionRate <= 100)
  
  const isUsernameValid = username.trim().length >= 3 && usernameStatus === 'available'
  const isPhoneNumberValid = phoneNumber.replace(/\D/g, '').length === 10
  const isBookingLinkValid = bookingLink.trim().length > 0
  const isCalendarConnected = calendarConnected
  
  const isProfileValid = 
    fullName.trim().length > 0 && 
    isPhoneNumberValid &&
    userType !== '' && 
    selectedRole.barber_type !== '' &&
    isCommissionValid &&
    isUsernameValid &&
    isBookingLinkValid

  const stepLabels = [
    { key: 'subscription', label: 'Subscription' },
    { key: 'profile', label: 'Profile' },
    { key: 'calendar', label: 'Calendar' },
    { key: 'booking-sync', label: 'Booking Sync' },
    { key: 'auto-nudge', label: 'Auto Nudge' }
  ]
  
  const getCurrentStepNumber = () => {
    if (!hasAccess) return 1
    if (currentOnboardingStep === 'profile') return 2
    if (currentOnboardingStep === 'calendar') return 3
    if (currentOnboardingStep === 'booking-sync') return 4
    return 5
  }
  
  const currentStepNumber = getCurrentStepNumber()

  const statusSummary = (() => {
    if (hasSub) {
      const renewalText = endDateText ? `Renews ${endDateText}` : 'Renews soon'
      const priceText = amountText ? `${amountText}/${interval === 'year' ? 'yr' : 'mo'}` : 'Plan active'
      return `${priceText} · ${renewalText}`
    }

    if (trialActive) {
      return `Free Trial · Ends ${trialEndText ?? 'in 7 days'}`
    }

    if (hasCheckoutComplete) {
      return 'Subscription processing'
    }

    return null
  })()

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#101312] via-[#1a1f1b] to-[#2e3b2b]">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* overlay */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            {/* slide-over sidebar */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="relative w-72 bg-[#1a1f1b] border-r border-white/10 p-6 shadow-2xl z-50 flex flex-col min-h-full"
            >
              <div className="flex justify-between items-center mb-6">
                <span className="text-emerald-300 text-2xl font-bold">Onboarding</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-gray-400 hover:text-white text-xl transition-colors"
                >
                  ✕
                </button>
              </div>
              
              {/* Mobile Steps */}
              <div className="space-y-3 flex-1">
                {stepLabels.map((step, index) => {
                  const stepNum = index + 1
                  const isActive = stepNum === currentStepNumber
                  const isComplete = stepNum < currentStepNumber
                  
                  return (
                    <div
                      key={step.key}
                      className={`p-4 rounded-xl border transition-all ${
                        isComplete
                          ? 'border-emerald-300/40 bg-emerald-400/10'
                          : isActive
                          ? 'border-emerald-300/40 bg-emerald-400/10'
                          : 'border-white/10 bg-black/20'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold ${
                          isComplete
                            ? 'border-emerald-300 bg-emerald-300 text-black'
                            : isActive
                            ? 'border-emerald-300 text-emerald-300'
                            : 'border-white/30 text-white/30'
                        }`}>
                          {isComplete ? '✓' : stepNum}
                        </div>
                        <div>
                          <p className={`text-sm font-semibold ${
                            isComplete || isActive ? 'text-white' : 'text-white/40'
                          }`}>
                            {step.label}
                          </p>
                          {stepNum === 1 && statusSummary && (
                            <p className="text-xs text-emerald-300 mt-0.5">
                              ✓ {statusSummary}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page Content */}
      <div
        className="min-h-screen px-4 py-6 md:px-8 md:py-8"
        style={{ paddingTop: 'calc(80px + 2.5rem)' }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">Onboarding</h1>
            <p className="text-xs text-gray-400">Complete setup to unlock dashboard</p>
          </div>

          <div className="flex flex-col lg:flex-row gap-6 lg:items-stretch">
            {/* Desktop Sidebar */}
            <div className="hidden lg:flex w-72 flex-shrink-0">
              <div className="w-full h-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
                <div className="space-y-3">
                  {stepLabels.map((step, index) => {
                    const stepNum = index + 1
                    const isActive = stepNum === currentStepNumber
                    const isComplete = stepNum < currentStepNumber
                    
                    return (
                      <div
                        key={step.key}
                        className={`p-4 rounded-xl border transition-all ${
                          isComplete
                            ? 'border-emerald-300/40 bg-emerald-400/10'
                            : isActive
                            ? 'border-emerald-300/40 bg-emerald-400/10'
                            : 'border-white/10 bg-black/20'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold ${
                            isComplete
                              ? 'border-emerald-300 bg-emerald-300 text-black'
                              : isActive
                              ? 'border-emerald-300 text-emerald-300'
                              : 'border-white/30 text-white/30'
                          }`}>
                            {isComplete ? '✓' : stepNum}
                          </div>
                          <div>
                            <p className={`text-sm font-semibold ${
                              isComplete || isActive ? 'text-white' : 'text-white/40'
                            }`}>
                              {step.label}
                            </p>
                            {stepNum === 1 && statusSummary && (
                              <p className="text-xs text-emerald-300 mt-0.5">
                                ✓ {statusSummary}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Mobile Menu Button */}
            <div className="flex lg:hidden">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-400 to-[#3af1f7] text-black rounded-full font-semibold shadow-lg hover:shadow-emerald-400/20 transition-all"
              >
                Menu
              </button>
            </div>

            {/* Main Content */}
            <motion.div
              key={currentOnboardingStep}
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex-1 flex flex-col"
            >
              {!hasAccess ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-xl h-full">
                  <div className="space-y-4">
                    {loading ? (
                      <div className="flex items-center gap-2 text-sm text-gray-300">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing your subscription…
                      </div>
                    ) : sessionStatus === 'open' ? (
                      <>
                        <p className="text-lg font-semibold text-white">Checkout not completed</p>
                        <p className="text-sm text-gray-300">
                          Please return to pricing to finish checkout and activate your plan.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-semibold text-white">No active subscription</p>
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
                </div>
              ) : (
                <>
                  {currentOnboardingStep === 'profile' ? (
                    <ProfileStep
                      fullName={fullName}
                      setFullName={setFullName}
                      phoneNumber={phoneNumber}
                      setPhoneNumber={setPhoneNumber}
                      userType={userType}
                      setUserType={setUserType}
                      selectedRole={selectedRole}
                      setSelectedRole={setSelectedRole}
                      commissionRate={commissionRate}
                      setCommissionRate={setCommissionRate}
                      username={username}
                      setUsername={setUsername}
                      usernameStatus={usernameStatus}
                      setUsernameStatus={setUsernameStatus}
                      bookingLink={bookingLink}
                      setBookingLink={setBookingLink}
                      avatarFile={avatarFile}
                      setAvatarFile={setAvatarFile}
                      avatarPreview={avatarPreview}
                      setAvatarPreview={setAvatarPreview}
                      showValidationErrors={showValidationErrors}
                      isProfileValid={isProfileValid}
                      isCommissionValid={isCommissionValid}
                      isUsernameValid={isUsernameValid}
                      isPhoneNumberValid={isPhoneNumberValid}
                      isBookingLinkValid={isBookingLinkValid}
                      onNext={handleNext}
                    />
                  ) : currentOnboardingStep === 'calendar' ? (
                    <CalendarStep
                      selectedProvider={selectedProvider}
                      setSelectedProvider={setSelectedProvider}
                      calendarStatus={calendarStatus}
                      acuityCalendars={acuityCalendars}
                      selectedAcuityCalendar={selectedAcuityCalendar}
                      setSelectedAcuityCalendar={setSelectedAcuityCalendar}
                      handleBeforeConnectAcuity={handleBeforeConnectAcuity}
                      handleAcuityConnectSuccess={handleAcuityConnectSuccess}
                      handleBeforeConnectSquare={handleBeforeConnectSquare}
                      onBack={handleBack}
                      onFinish={handleNext}
                      onSaveCalendar={handleSaveCalendar}
                      isCalendarConnected={isCalendarConnected}
                      profileLoading={profileLoading}
                    />
                  ) : currentOnboardingStep === 'booking-sync' ? (
                    <BookingSyncStep
                      onBack={handleBack}
                      onNext={handleNext}
                      profileLoading={profileLoading}
                    />
                  ) : (
                    <AutoNudgeActivationStep
                      onBack={handleBack}
                      onFinish={handleFinishOnboarding}
                      profileLoading={profileLoading}
                    />
                  )}
                </>
              )}
            </motion.div>
          </div>
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