// utils/checkOnboarding.ts
import { useEffect } from 'react'
import { supabase } from './supabaseClient'
import { useRouter } from 'next/navigation'

export function useCheckOnboarding() {
  const router = useRouter()

  useEffect(() => {
    const checkOnboarding = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('onboarded')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!error && profile?.onboarded === false) {
        router.push('/onboarding')
      }
    }

    checkOnboarding()
  }, [router])
}
