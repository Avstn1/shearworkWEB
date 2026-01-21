'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  ReactNode,
  useMemo
} from 'react'
import { supabase } from '@/utils/supabaseClient'
import { User, Session } from '@supabase/supabase-js'

interface Profile {
  role: string
  stripe_subscription_status: string
  full_name?: string
  trial_active?: boolean
  trial_start?: string | null
  trial_end?: string | null
  [key: string]: unknown
}

interface AuthContextType {
  user: User | null
  profile: Profile | null
  isLoading: boolean
  isAdmin: boolean
  isPremiumUser: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isLoading: false,
  isAdmin: false,
  isPremiumUser: false
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const profileFetchInFlight = useRef(false)

  // -----------------------------
  // LOAD PROFILE (SINGLE SOURCE)
  // -----------------------------
  const loadProfile = async (session: Session) => {
    if (profileFetchInFlight.current) return
    profileFetchInFlight.current = true

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (error) {
        console.error('Profile fetch error:', error)
        setProfile(null)
      } else {
        setProfile(data)
      }
    } finally {
      profileFetchInFlight.current = false
    }
  }

  // -----------------------------
  // INITIAL SESSION LOAD
  // -----------------------------
  useEffect(() => {
    let mounted = true

    const init = async () => {
      const { data, error } = await supabase.auth.getSession()

      if (!mounted) return

      if (error || !data.session?.user) {
        setUser(null)
        setProfile(null)
        setIsLoading(false)
        return
      }

      setUser(data.session.user)
      await loadProfile(data.session)
      setIsLoading(false)
    }

    init()

    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          setIsLoading(false)
          return
        }

        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
          setUser(session.user)
          await loadProfile(session)
          setIsLoading(false)
        }
      }
    )

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [])

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
      isPremiumUser
    }),
    [user, profile, isLoading, isAdmin, isPremiumUser]
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
