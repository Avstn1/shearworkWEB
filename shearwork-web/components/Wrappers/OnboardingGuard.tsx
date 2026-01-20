'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/utils/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'

export default function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, profile, isLoading } = useAuth()


  useEffect(() => {
    const checkOnboarding = async () => {
      if (!profile?.onboarded) {
        router.replace('/onboarding')
      }
    }

    checkOnboarding()
  }, [router])

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen text-[var(--accent-2)]">
        Loading onboarding guard...
      </div>
    )
  }

  return <>{children}</>
}
