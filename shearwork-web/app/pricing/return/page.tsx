'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function PricingReturnPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    console.log('Stripe session_id:', sessionId)

    // TODO: later call an API route here to verify the session
    // and mark the user as subscribed in Supabase.
    // For now, just send them to the dashboard.
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
