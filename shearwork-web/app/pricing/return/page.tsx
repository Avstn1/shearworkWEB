'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function PricingReturnPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const sessionId = searchParams.get('session_id')
    console.log('Stripe session_id:', sessionId)

    // TODO: verify the session via API and mark user in Supabase
    router.replace('/dashboard')
  }, [mounted, router, searchParams])

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
