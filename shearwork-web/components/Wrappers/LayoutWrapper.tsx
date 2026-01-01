'use client'

import { ReactNode, useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { createBrowserClient } from '@supabase/ssr'

export default function LayoutWrapper({ children }: { children: ReactNode }) {
  const [hasSession, setHasSession] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const hasCompletedInitialAuth = useRef(false)
  const router = useRouter()
  const pathname = usePathname()
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Public routes that don't need authentication
  const publicRoutes = ['/', '/login', '/signup']
  const isPublicRoute = publicRoutes.includes(pathname)

  useEffect(() => {
    let mounted = true

    const checkUserRole = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (!mounted) return

        if (sessionError) {
          console.error('Session error:', sessionError)
          setIsInitialLoad(false)
          setHasSession(false)
          hasCompletedInitialAuth.current = true
          if (!isPublicRoute) {
            router.push('/')
          }
          return
        }
        
        if (!session) {
          setHasSession(false)
          setIsInitialLoad(false)
          hasCompletedInitialAuth.current = true
          if (!isPublicRoute) {
            router.push('/')
          }
          return
        }

        setHasSession(true)

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', session.user.id)
          .single()

        if (!mounted) return

        if (profileError) {
          console.error('Profile error:', profileError)
          setIsAdmin(false)
        } else {
          setIsAdmin(profile?.role === 'Admin')
        }
        
        setIsInitialLoad(false)
        hasCompletedInitialAuth.current = true

        // If we just logged in on a public route, redirect to dashboard
        if (isPublicRoute && pathname !== '/') {
          router.push('/dashboard')
        }
      } catch (err) {
        console.error('Auth check error:', err)
        if (mounted) {
          setIsInitialLoad(false)
          setHasSession(false)
          hasCompletedInitialAuth.current = true
        }
      }
    }

    checkUserRole()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      
      if (event === 'SIGNED_IN') {
        setHasSession(true)
        // Redirect to dashboard after sign in
        if (isPublicRoute) {
          router.push('/dashboard')
        }
      }
      
      if (event === 'SIGNED_OUT') {
        setHasSession(false)
        setIsAdmin(false)
        router.push('/')
        return
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // Show loading only for protected routes
  if (isInitialLoad && !isPublicRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#101312] via-[#1a1f1b] to-[#2e3b2b]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#73aa57] mb-4"></div>
          <p className="text-sm text-[#bdbdbd]">Loading...</p>
        </div>
      </div>
    )
  }

  // Don't render protected content on public routes if not logged in
  if (!hasSession && !isPublicRoute) {
    return null
  }

  const showSidebar = hasSession && !isAdmin

  return (
    <>
      {showSidebar && <Sidebar />}
      <div 
        className={`min-h-screen transition-all duration-300 ${
          showSidebar ? 'md:ml-[var(--sidebar-width,0px)] md:w-[calc(100%-var(--sidebar-width,0px))]' : ''
        }`}
      >
        {children}
      </div>
    </>
  )
}