'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { isTrialActive } from '@/utils/trial'

export default function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, profile, isLoading, profileStatus } = useAuth()

  useEffect(() => {
    // Don't check until we've finished loading
    if (isLoading) return
    
    // Don't check if no user
    if (!user) return

    // Wait for profile fetch to complete (not idle or loading)
    if (profileStatus === 'idle' || profileStatus === 'loading') return

    // If user is on a pricing flow (checkout or return), don't interfere —
    // the return page handles its own polling and redirect logic
    if (pathname?.startsWith('/pricing')) return
    
    // Redirect to pricing if profile exists but trial is not active
    // Use isTrialActive() to properly check trial status (handles undefined/null correctly)
    // Also check for active subscription
    if (profile && profile.stripe_subscription_status !== 'active' && !isTrialActive(profile)) {
      router.replace('/pricing')
      return
    }

    // Redirect to pricing/return if profile exists but onboarded is false
    if (profile && !profile.onboarded) {
      console.log('🟢 Redirecting to pricing/return - onboarded:', profile.onboarded)
      router.replace('/pricing/return')
    }
  }, [isLoading, user, profile, profileStatus, router, pathname])

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen text-[var(--accent-2)]">
        Loading onboarding guard...
      </div>
    )
  }

  return <>{children}</>
}