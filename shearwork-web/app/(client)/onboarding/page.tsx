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
    <div className="min-h-screen flex items-center justify-center bg-canvas text-ivory px-4">
      <div className="flex items-center gap-3 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin text-sage" />
        Redirecting to pricing…
      </div>
    </div>
  )
}
