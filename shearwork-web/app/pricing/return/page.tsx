'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

type BillingSummary = {
  hasSubscription: boolean
  cancel_at_period_end: boolean
  current_period_end?: number | null
  price?: {
    amount: number
    currency: string
    interval: string | null
    interval_count: number | null
  }
}

function PricingReturnContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<BillingSummary | null>(null)

  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    console.log('Stripe session_id (for debugging):', sessionId)

    const fetchSummary = async () => {
      try {
        const res = await fetch('/api/stripe/billing-summary')
        const data = await res.json()
        if (!res.ok) {
          console.error('Failed to load billing summary on return page:', data)
          setSummary(null)
        } else {
          setSummary(data)
        }
      } catch (err) {
        console.error('Error loading billing summary on return page:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchSummary()
  }, [searchParams])

  const formatAmount = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(amount / 100)

  const formatDate = (ts?: number | null) => {
    if (!ts) return null
    return new Date(ts * 1000).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const hasSub = summary?.hasSubscription
  const interval = summary?.price?.interval
  const intervalLabel =
    interval === 'year' ? 'yearly' : interval === 'month' ? 'monthly' : 'recurring'
  const amountText =
    summary?.price &&
    formatAmount(summary.price.amount, summary.price.currency)
  const endDateText = formatDate(summary?.current_period_end ?? null)

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white px-4">
      <div className="w-full max-w-md text-center space-y-4 bg-[#121212] border border-white/10 rounded-2xl p-6">
        {loading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-sm text-gray-300">
              Processing your subscription…
            </p>
          </div>
        ) : hasSub ? (
          <>
            <p className="text-lg font-semibold">Thanks for subscribing 🎉</p>
            <p className="text-sm text-gray-300">
              You&apos;re now on the{' '}
              <span className="font-semibold">Corva Pro</span>{' '}
              <span className="font-semibold">{intervalLabel}</span> plan.
            </p>
            <p className="text-sm text-gray-300">
              Your current period ends on{' '}
              <span className="font-semibold">
                {endDateText ?? 'the current billing period end date'}
              </span>
              .
            </p>
            <p className="text-sm text-gray-400">
              You&apos;ll be charged{' '}
              <span className="font-semibold">
                {amountText ?? 'your plan price'}
              </span>{' '}
              per {interval === 'year' ? 'year' : 'month'} unless you cancel.
            </p>
          </>
        ) : (
          <>
            <p className="text-lg font-semibold">Thanks for subscribing 🎉</p>
            <p className="text-sm text-gray-300">
              We&apos;re processing your subscription. If you don&apos;t see
              changes right away, they should appear on your dashboard soon.
            </p>
          </>
        )}

        <button
          onClick={() => router.push('/dashboard')}
          className="mt-2 inline-flex items-center justify-center px-4 py-2 rounded-xl bg-gradient-to-r from-[#7affc9] to-[#3af1f7] text-black text-sm font-semibold w-full"
        >
          Go to dashboard
        </button>
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
