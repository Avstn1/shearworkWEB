'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  ReactNode,
  useMemo,
  useCallback,
} from 'react'
import { supabase } from '@/utils/supabaseClient'
import {
  isTrialActive,
  getTrialDayNumber,
  getTrialDaysRemaining,
  getTrialPromptMode,
} from '@/utils/trial'
import type { TrialPromptMode } from '@/components/Dashboard/TrialPromptModal'
import type { AuthChangeEvent, PostgrestSingleResponse, Session, User } from '@supabase/supabase-js'

interface Profile {
  role: string
  stripe_subscription_status: string
  full_name?: string
  trial_active?: boolean
  trial_start?: string | null
  trial_end?: string | null
  onboarded?: boolean | null
  special_access?: boolean | null
  last_read_feature_updates?: string | null
  date_autonudge_enabled?: string | null
  [key: string]: unknown
}

type ProfileStatus = 'idle' | 'loading' | 'ready' | 'error'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  isLoading: boolean
  isAdmin: boolean
  isPremiumUser: boolean
  profileStatus: ProfileStatus
  refreshProfile: () => Promise<void>
  // Trial-related
  trialDayNumber: number
  trialDaysRemaining: number
  hasPaymentMethod: boolean
  trialPromptMode: TrialPromptMode | null
  refreshPaymentMethod: () => Promise<void>
}

const PROFILE_TIMEOUT_MS = 15000
const PROFILE_RETRY_DELAY_MS = 1200
const MAX_PROFILE_RETRIES = 2

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, label: string) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isLoading: false,
  isAdmin: false,
  isPremiumUser: false,
  profileStatus: 'idle',
  refreshProfile: async () => {},
  // Trial-related defaults
  trialDayNumber: 0,
  trialDaysRemaining: 0,
  hasPaymentMethod: false,
  trialPromptMode: null,
  refreshPaymentMethod: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>('idle')
  const [hasPaymentMethod, setHasPaymentMethod] = useState(false)
  const [paymentMethodChecked, setPaymentMethodChecked] = useState(false)

  const profileFetchInFlight = useRef(false)
  const profileRetryCount = useRef(0)
  const initialProfileLoaded = useRef(false)
  const sessionCleanupTriggered = useRef(false)
  const initialSessionResolved = useRef(false)

  const resetAuthState = useCallback(() => {
    setUser(null)
    setProfile(null)
    setProfileStatus('idle')
    profileRetryCount.current = 0
    setIsLoading(false)
    initialProfileLoaded.current = true
  }, [])

  const loadProfile = useCallback(async (userId: string): Promise<void> => {
    if (profileFetchInFlight.current) return
    profileFetchInFlight.current = true
    setProfileStatus('loading')

    try {
      const fetchProfile = async (attempt: number): Promise<PostgrestSingleResponse<Profile>> => {
        const profilePromise = supabase
          .from('profiles')
          .select(
            'role, stripe_subscription_status, full_name, trial_active, trial_start, trial_end, onboarded, special_access, last_read_feature_updates, date_autonudge_enabled'
          )
          .eq('user_id', userId)
          .maybeSingle() as unknown as Promise<PostgrestSingleResponse<Profile>>

        const result = await withTimeout(profilePromise, PROFILE_TIMEOUT_MS, 'Profile fetch')

        if (result.error && attempt === 0) {
          await new Promise(resolve => setTimeout(resolve, PROFILE_RETRY_DELAY_MS))
          return fetchProfile(1)
        }

        return result
      }

      const { data, error } = await fetchProfile(0)

      if (error) {
        console.error('Profile fetch error:', error)
        setProfile(null)
        if (profileRetryCount.current < MAX_PROFILE_RETRIES) {
          profileRetryCount.current += 1
          setProfileStatus('loading')
          return
        }
        setProfileStatus('error')
      } else {
        profileRetryCount.current = 0
        setProfile(data)
        setProfileStatus('ready')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Profile fetch failed'
      console.error(message)
      setProfile(null)
      if (profileRetryCount.current < MAX_PROFILE_RETRIES) {
        profileRetryCount.current += 1
        setProfileStatus('loading')
        return
      }
      setProfileStatus('error')
    } finally {
      profileFetchInFlight.current = false
    }

    if (profileRetryCount.current > 0 && profileRetryCount.current <= MAX_PROFILE_RETRIES) {
      setTimeout(() => {
        void loadProfile(userId)
      }, PROFILE_RETRY_DELAY_MS)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const handleAuthChange = async (event: AuthChangeEvent, session: Session | null) => {
      if (!mounted) return

      if (event === 'INITIAL_SESSION') {
        initialSessionResolved.current = true
        if (session?.user) {
          if (!session.refresh_token) {
            if (!sessionCleanupTriggered.current) {
              sessionCleanupTriggered.current = true
              try {
                await supabase.auth.signOut({ scope: 'local' })
              } catch (error) {
                console.error('Auth cleanup failed:', error)
              }
            }
            resetAuthState()
            return
          }

          setUser(session.user)
          return
        }

        resetAuthState()
        return
      }

      if (event === 'SIGNED_OUT') {
        resetAuthState()
        return
      }

      if (
        (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') &&
        session?.user
      ) {
        setUser(session.user)
      }
    }

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      void handleAuthChange(event, session)
    })

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [resetAuthState])

  useEffect(() => {
    let active = true

    if (!user?.id) {
      if (!initialSessionResolved.current) {
        return
      }
      setProfile(null)
      setProfileStatus('idle')
      profileRetryCount.current = 0
      if (!initialProfileLoaded.current) {
        setIsLoading(false)
        initialProfileLoaded.current = true
      }
      return
    }

    const run = async () => {
      await loadProfile(user.id)
      if (!active) return
      if (!initialProfileLoaded.current) {
        setIsLoading(false)
        initialProfileLoaded.current = true
      }
    }

    run()

    return () => {
      active = false
    }
  }, [user?.id, loadProfile])

  const refreshProfile = useCallback(async () => {
    if (!user?.id) return
    await loadProfile(user.id)
  }, [loadProfile, user?.id])

  // Check payment method when profile is ready
  const checkPaymentMethod = useCallback(async () => {
    if (!user?.id) {
      setHasPaymentMethod(false)
      setPaymentMethodChecked(true)
      return
    }

    try {
      const res = await fetch('/api/stripe/has-payment-method')
      if (res.ok) {
        const data = await res.json()
        setHasPaymentMethod(data.hasPaymentMethod ?? false)
      } else {
        setHasPaymentMethod(false)
      }
    } catch (err) {
      console.error('Failed to check payment method:', err)
      setHasPaymentMethod(false)
    } finally {
      setPaymentMethodChecked(true)
    }
  }, [user?.id])

  // Check payment method when profile becomes ready
  useEffect(() => {
    if (profileStatus === 'ready' && user?.id && !paymentMethodChecked) {
      void checkPaymentMethod()
    }
  }, [profileStatus, user?.id, paymentMethodChecked, checkPaymentMethod])

  // Reset payment method state when user changes
  useEffect(() => {
    if (!user?.id) {
      setHasPaymentMethod(false)
      setPaymentMethodChecked(false)
    }
  }, [user?.id])

  const isAdmin = profile?.role === 'Admin' || profile?.role === 'Owner'

  const isPremiumUser =
    profile?.stripe_subscription_status === 'active' ||
    isTrialActive(profile)

  // Trial calculations
  const trialDayNumber = useMemo(() => getTrialDayNumber(profile), [profile])
  const trialDaysRemaining = useMemo(() => getTrialDaysRemaining(profile), [profile])
  const trialPromptMode = useMemo(
    () => getTrialPromptMode(profile, hasPaymentMethod),
    [profile, hasPaymentMethod]
  )

  const value = useMemo(
    () => ({
      user,
      profile,
      isLoading,
      isAdmin,
      isPremiumUser,
      profileStatus,
      refreshProfile,
      // Trial-related
      trialDayNumber,
      trialDaysRemaining,
      hasPaymentMethod,
      trialPromptMode,
      refreshPaymentMethod: checkPaymentMethod,
    }),
    [
      user,
      profile,
      isLoading,
      isAdmin,
      isPremiumUser,
      profileStatus,
      refreshProfile,
      trialDayNumber,
      trialDaysRemaining,
      hasPaymentMethod,
      trialPromptMode,
      checkPaymentMethod,
    ]
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
