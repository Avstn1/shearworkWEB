'use client'

import { createContext, useContext, useEffect, useState, useRef, ReactNode, useMemo } from 'react'
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
  isPremiumUser: false,
})

// Helper to get initial session from localStorage
function getInitialSession(): User | null {
  if (typeof window === 'undefined') return null
  
  try {
    // Log all localStorage keys to find the right one
    console.log('🟣 All localStorage keys:', Object.keys(localStorage))
    
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    console.log('🟣 Supabase URL:', url)
    
    const projectRef = url?.split('//')[1]?.split('.')[0]
    console.log('🟣 Project ref:', projectRef)
    
    const key = `sb-${projectRef}-auth-token`
    console.log('🟣 Looking for key:', key)
    
    const stored = localStorage.getItem(key)
    console.log('🟣 Stored value exists:', !!stored)
    
    if (stored) {
      const parsed = JSON.parse(stored)
      console.log('🟣 Parsed session:', {
        hasCurrentSession: !!parsed?.currentSession,
        hasUser: !!parsed?.currentSession?.user,
        userId: parsed?.currentSession?.user?.id
      })
      return parsed?.currentSession?.user || null
    }
  } catch (error) {
    console.error('🟣 Error reading initial session:', error)
  }
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  console.log('🔵 AuthProvider mounting')
  const [user, setUser] = useState<User | null>(null) // Start null, will load from localStorage in useEffect
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const sessionHandled = useRef(false)
  const isClient = useRef(false)

  console.log('🔵 AuthProvider render - isLoading:', isLoading, 'user:', !!user)

  useEffect(() => {
    console.log('🔵 useEffect starting')
    
    // On first client mount, try to load from localStorage immediately
    if (!isClient.current) {
      isClient.current = true
      const cachedUser = getInitialSession()
      if (cachedUser) {
        console.log('🔵 Found cached user in localStorage')
        setUser(cachedUser)
      }
    }
    
    const loadSession = async (session: Session) => {
      console.log('🔵 loadSession called with session:', !!session)
      if (sessionHandled.current) {
        console.log('🔵 Session already handled, skipping')
        return
      }
      
      sessionHandled.current = true
      
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .single()

        if (profileError) {
          console.error('Profile error:', profileError)
        }

        setUser(session.user)
        setProfile(profileData || null)
      } catch (error) {
        console.error('Error loading session:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    const initAuth = async () => {
      console.log('🔵 initAuth starting')
      try {
        console.log('🔵 About to call getSession')
        
        // Race getSession against a timeout
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('getSession timeout')), 3000)
        )
        
        const { data: { session }, error } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]) as any
        
        console.log('🔵 getSession result:', { session: !!session, error })
        
        if (error || !session?.user) {
          console.log('🔵 No session from getSession')
          setIsLoading(false)
          setUser(null) // Clear the initial localStorage user if getSession says no session
          return
        }

        await loadSession(session)
        
      } catch (error: any) {
        if (error?.message === 'getSession timeout') {
          console.log('🔵 getSession timeout - waiting for onAuthStateChange fallback')
          // Give onAuthStateChange 500ms to fire, otherwise stop loading
          setTimeout(() => {
            if (!sessionHandled.current) {
              console.log('🔵 onAuthStateChange did not fire, stopping loading')
              setIsLoading(false)
            }
          }, 500)
        } else {
          console.error('🔵 getSession failed:', error)
          setUser(null)
          setIsLoading(false)
        }
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔴 Auth event:', event, 'sessionHandled:', sessionHandled.current)
      
      if (event === 'SIGNED_IN' && session?.user && !sessionHandled.current) {
        console.log('🔴 Processing SIGNED_IN event (getSession failed/timeout)')
        await loadSession(session)
      }
      
      if (event === 'SIGNED_OUT') {
        console.log('🔴 Processing SIGNED_OUT event')
        setUser(null)
        setProfile(null)
        setIsLoading(false)
        sessionHandled.current = false
      }
      
      if (event === 'TOKEN_REFRESHED' && session?.user) {
        console.log('🔴 Token refreshed')
        setUser(session.user)
      }
    })

    // Safety timeout - if nothing happens in 5 seconds, stop loading
    const safetyTimeout = setTimeout(() => {
      if (!sessionHandled.current) {
        console.log('⚠️ Safety timeout - no session loaded')
        setIsLoading(false)
      }
    }, 5000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(safetyTimeout)
    }
  }, [])

  const isAdmin = profile?.role === 'Admin' || profile?.role === 'Owner'
  const isPremiumUser = profile?.stripe_subscription_status === 'active' || 
                        profile?.stripe_subscription_status === 'trialing'

  const value = useMemo(() => ({ user, profile, isLoading, isAdmin, isPremiumUser }), [user, profile, isLoading, isAdmin, isPremiumUser])

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