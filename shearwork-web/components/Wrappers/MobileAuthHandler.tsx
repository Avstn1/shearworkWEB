// MobileAuthHandler.tsx
'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'

export default function MobileAuthHandler() {
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const code = searchParams.get('code')
    const src = searchParams.get('src')
    if (!code) return

    const run = async () => {
      try {
        const res = await fetch('/api/mobile-web-redirect/verify-web-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code })
        })

        const data = await res.json()

        if (!res.ok || !data.access_token) {
          toast.error(data.error || 'Invalid or expired code.')
          router.push('/login')
          return
        }

        await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token
        })

        toast.success('Successfully authenticated!')
        
        // Redirect to credits if src is not provided, otherwise go to pricing (src is set for users coming from the pricing page)
        if (!src) {
          globalThis.location.href = '/settings?openCredits=true'
        }
      } catch {
        toast.error('Authentication failed')
        router.push('/login')
      }
    }

    run()
  }, [searchParams, router])

  return null
}
