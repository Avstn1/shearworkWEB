'use client'

import { ReactNode, useEffect, Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'

function LayoutWrapperContent({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, profile, isAdmin, isPremiumUser, isLoading } = useAuth()

  // Public routes that don't need authentication
  const publicRoutes = ['/', '/login', '/signup', '/pricing', '/settings']
  const normalPublicRoutes = ['/', '/login', '/signup']
  const isPublicRoute = publicRoutes.includes(pathname)
  const isNormalPublicRoute = normalPublicRoutes.includes(pathname)

  // Handle authentication from mobile app code
  useEffect(() => {
    const authenticateUser = async () => {
      const code = searchParams.get('code')
      if (!code) return
      
      try {
        console.log('Starting auth with code:', code)
        
        const response = await fetch('/api/mobile-web-redirect/verify-web-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code })
        })

        console.log('Response status:', response.status)
        const data = await response.json()
        console.log('Response data:', data)
        
        if (!response.ok || !data.access_token) {
          console.log('Auth failed - invalid response')
          toast.error(data.error || 'Invalid or expired code. Please try again from the app.')
          router.push('/login')
          return
        }
        
        await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token
        })

        toast.success('Successfully authenticated!')

        setTimeout(() => {
          globalThis.location.href = '/settings?openCredits=true'
        }, 500)
        
      } catch (err: any) {
        console.error('Auth error:', err)
        toast.error('Authentication failed')
        router.push('/login')
      }
    }

    authenticateUser()
  }, [code, router])

  // Handle redirections after auth is loaded
  useEffect(() => {
    console.log('🟡 LayoutWrapper redirect effect:', { isLoading, pathname, user: !!user })
    if (isLoading) return

    const role = profile?.role?.toLowerCase()
    const subStatus = profile?.stripe_subscription_status

    // Redirect active/trial users away from /pricing
    if ((subStatus === 'active' || subStatus === 'trialing') && pathname === '/pricing') {
      router.push('/dashboard')
      return
    }

    // Premium access check for protected routes
    const premiumRoutes = ['/dashboard', '/account', '/premium', '/user-editor', '/expenses']
    const hasPremiumAccess = subStatus === 'active' || subStatus === 'trialing'
    
    if (
      user &&
      role !== 'admin' &&
      role !== 'owner' &&
      premiumRoutes.some(path => pathname.startsWith(path))
    ) {
      if (!hasPremiumAccess) {
        router.push('/pricing')
        return
      }
    }

    // Role-based redirects for admins/owners
    if ((role === 'admin' || role === 'owner') && (pathname === '/' || pathname === '/dashboard')) {
      router.push('/admin/dashboard')
      return
    }

    // Redirect non-admin authenticated users from home to dashboard
    if (user && role !== 'admin' && role !== 'owner' && pathname === '/') {
      console.log('🟡 REDIRECTING to:', '/dashboard') // or whatever
      router.push('/dashboard')
      return
    }

    // Redirect authenticated users away from login/signup
    if (user && (pathname === '/login' || pathname === '/signup')) {
      console.log('🟡 REDIRECTING to:', '/dashboard') // or whatever
      router.push('/dashboard')
      return
    }
  }, [isLoading, user, profile, pathname, router])

  // Show loading only for protected routes
  if (isLoading && !isPublicRoute) {
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
  if (!user && !isPublicRoute) {
    return null
  }

  const showSidebar = user && !isAdmin && isPremiumUser

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

export default function LayoutWrapper({ children }: { children: ReactNode }) {
  return (
    <LayoutWrapperContent>
      {children}
    </LayoutWrapperContent>
  )
}