'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/utils/supabaseClient'

export default function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkOnboarding = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarded')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!profile?.onboarded) {
        router.replace('/onboarding')
      } else {
        setLoading(false)
      }
    }

    checkOnboarding()
  }, [router])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen text-[var(--accent-2)]">
        Loading...
      </div>
    )
  }

  return <>{children}</>
}
