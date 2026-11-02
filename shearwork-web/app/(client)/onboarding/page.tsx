'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function OnboardingRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    console.log('Redirecting to pricing page from onboarding...')
    router.replace('/pricing')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0A0C0B] via-[#0E110F] to-[#161A18] text-white px-4">
      <div className="flex items-center gap-3 text-sm text-gray-300">
        <Loader2 className="h-4 w-4 animate-spin" />
        Redirecting to pricing…
      </div>
    </div>
  )
}
