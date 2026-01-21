'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, profile, isLoading } = useAuth()

  useEffect(() => {
    console.log('🟢 OnboardingGuard useEffect - isLoading:', isLoading, 'profile:', profile)
    if (isLoading) return
    if (!user) return
    
    if (profile && !profile.onboarded) {
      console.log('🟢 Redirecting to onboarding - onboarded:', profile.onboarded)
      router.replace('/onboarding')
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