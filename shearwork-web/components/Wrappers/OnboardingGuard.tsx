'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, profile, isLoading } = useAuth()

  useEffect(() => {
    // Don't check until we've finished loading
    if (isLoading) return
    
    // Don't check if no user
    if (!user) return
    
    // Redirect to pricing/return if profile exists but onboarded is false
    if (profile && !profile.onboarded) {
      console.log('🟢 Redirecting to pricing/return - onboarded:', profile.onboarded)
      router.replace('/pricing/return')
    }
  }, [isLoading, user, profile, router])

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen text-[var(--accent-2)]">
        Loading onboarding guard...
      </div>
    )
  }

  return <>{children}</>
}