'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  ReactNode,
  useMemo,
  useCallback
} from 'react'
import { supabase } from '@/utils/supabaseClient'
import { User, Session, PostgrestSingleResponse } from '@supabase/supabase-js'

interface Profile {
  role: string
  stripe_subscription_status: string
  full_name?: string
  trial_active?: boolean
  trial_start?: string | null
  trial_end?: string | null
  onboarded?: boolean | null
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
}

const SESSION_TIMEOUT_MS = 6000
const PROFILE_TIMEOUT_MS = 7000

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
  profileStatus: 'idle'
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>('idle')

  const profileFetchInFlight = useRef(false)
  const initInFlight = useRef(false)

  // -----------------------------
  // LOAD PROFILE (SINGLE SOURCE)
  // -----------------------------
  const loadProfile = useCallback(async (session: Session): Promise<void> => {
    if (profileFetchInFlight.current) return
    profileFetchInFlight.current = true
    setProfileStatus('loading')

    try {
      const profilePromise = supabase
        .from('profiles')
        .select('role, stripe_subscription_status, full_name, trial_active, trial_start, trial_end, onboarded')
        .eq('user_id', session.user.id)
        .maybeSingle() as unknown as Promise<PostgrestSingleResponse<Profile>>

      const { data, error } = await withTimeout(profilePromise, PROFILE_TIMEOUT_MS, 'Profile fetch')

      if (error) {
        console.error('Profile fetch error:', error)
        setProfile(null)
        setProfileStatus('error')
      } else {
        setProfile(data)
        setProfileStatus('ready')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Profile fetch failed'
      console.error(message)
      setProfile(null)
      setProfileStatus('error')
    } finally {
      profileFetchInFlight.current = false
    }
  }, [])

  // -----------------------------
  // INITIAL SESSION LOAD
  // -----------------------------
  useEffect(() => {
    let mounted = true

    const init = async () => {
      if (initInFlight.current) return
      initInFlight.current = true

      type SessionResult = Awaited<ReturnType<typeof supabase.auth.getSession>>
      let sessionResult: SessionResult | null = null

      try {
        sessionResult = await withTimeout(
          supabase.auth.getSession(),
          SESSION_TIMEOUT_MS,
          'Session load'
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Session load failed'
        console.error(message)
      }

      if (!mounted) return

      const session = sessionResult?.data?.session ?? null
      const sessionError = sessionResult?.error ?? null

      if (sessionError || !session?.user) {
        setUser(null)
        setProfile(null)
        setProfileStatus('idle')
        setIsLoading(false)
        initInFlight.current = false
        return
      }

      setUser(session.user)
      setIsLoading(false)
      void loadProfile(session)
      initInFlight.current = false
    }

    init()

    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          setProfileStatus('idle')
          setIsLoading(false)
          return
        }

        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
          setUser(session.user)
          void loadProfile(session)
          setIsLoading(false)
        }
      }
    )

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [loadProfile])

  // -----------------------------
  // DERIVED FLAGS (UNCHANGED)
  // -----------------------------
  const isAdmin =
    profile?.role === 'Admin' || profile?.role === 'Owner'

  const isPremiumUser =
    profile?.stripe_subscription_status === 'active' ||
    profile?.stripe_subscription_status === 'trialing'

  const value = useMemo(
    () => ({
      user,
      profile,
      isLoading,
      isAdmin,
      isPremiumUser,
      profileStatus
    }),
    [user, profile, isLoading, isAdmin, isPremiumUser, profileStatus]
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
