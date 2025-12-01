'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function PricingReturnContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    console.log('Stripe session_id:', sessionId)

    // TODO: verify session via API and mark user in Supabase
    router.replace('/dashboard')
  }, [router, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="text-center space-y-2">
        <p className="text-lg font-semibold">Thanks for subscribing 🎉</p>
        <p className="text-sm text-gray-300">
          Processing your subscription and redirecting you to your dashboard…
        </p>
      </div>
    </div>
  )
}

export default function PricingReturnPage() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <PricingReturnContent />
    </Suspense>
  )
}
