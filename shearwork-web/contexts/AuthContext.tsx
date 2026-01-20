'use client'

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { User } from '@supabase/supabase-js'

// Create and export stable supabase client instance
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Profile {
  role: string
  stripe_subscription_status: string
  full_name?: string
  [key: string]: any
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
  isLoading: true,
  isAdmin: false,
  isPremiumUser: false,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const hasInitialized = useRef(false)

  useEffect(() => {
    // Initial session check
    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Session error:', error)
          setIsLoading(false)
          return
        }
        
        if (!session?.user) {
          setIsLoading(false)
          return
        }

        setUser(session.user)

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .single()

        if (profileError) {
          console.error('Profile error:', profileError)
        } else {
          setProfile(profileData)
        }
        
        hasInitialized.current = true
      } catch (error) {
        console.error('Auth init error:', error)
      } finally {
        setIsLoading(false)
      }
    }

    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Ignore INITIAL_SESSION and SIGNED_IN events after we've already initialized
      if (hasInitialized.current && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
        return
      }
      
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user)
        
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .single()
        
        setProfile(profileData)
        hasInitialized.current = true
      }
      
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
        hasInitialized.current = false
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const isAdmin = profile?.role === 'Admin' || profile?.role === 'Owner'
  const isPremiumUser = profile?.stripe_subscription_status === 'active' || 
                        profile?.stripe_subscription_status === 'trialing'

  return (
    <AuthContext.Provider value={{ user, profile, isLoading, isAdmin, isPremiumUser }}>
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