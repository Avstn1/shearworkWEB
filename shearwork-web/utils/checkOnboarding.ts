// utils/checkOnboarding.ts
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export function useCheckOnboarding() {
  const router = useRouter()
  const { user, profile, isLoading } = useAuth()

  useEffect(() => {
    if (isLoading) return

    if (!user) {
      router.push('/login')
      return
    }

    if (profile?.onboarded === false) {
      router.push('/pricing/return')
    }
  }, [isLoading, profile?.onboarded, router, user])
}
