'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function OnboardingRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/pricing')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#101312] via-[#1a1f1b] to-[#2e3b2b] text-white px-4">
      <div className="flex items-center gap-3 text-sm text-gray-300">
        <Loader2 className="h-4 w-4 animate-spin" />
        Redirecting to pricing…
      </div>
    </div>
  )
}
