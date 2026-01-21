'use client'

import { ReactNode, Suspense, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/contexts/AuthContext'
import MobileAuthHandler from './MobileAuthHandler'

function LayoutWrapperContent({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, profile, isAdmin, isPremiumUser, isLoading } = useAuth()

  // Public routes that don't need authentication
  const publicRoutes = ['/', '/login', '/signup', '/pricing', '/settings']
  const isPublicRoute = publicRoutes.includes(pathname)

  // -----------------------------
  // Keep your redirect logic exactly as before
  // -----------------------------
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
      console.log('🟡 REDIRECTING to:', '/dashboard')
      router.push('/dashboard')
      return
    }

    // Redirect authenticated users away from login/signup
    if (user && (pathname === '/login' || pathname === '/signup')) {
      console.log('🟡 REDIRECTING to:', '/dashboard')
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
      {/* Mobile auth code safely handled in Suspense */}
      <Suspense fallback={null}>
        <MobileAuthHandler />
      </Suspense>

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
  return <LayoutWrapperContent>{children}</LayoutWrapperContent>
}
