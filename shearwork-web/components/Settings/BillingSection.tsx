'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function BillingSection() {
  const [loading, setLoading] = useState(false)

  const openBillingPortal = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Could not open billing portal')
      }

      // Redirect to Stripe-hosted portal
      window.location.href = data.url
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold">Billing</h3>
      <p className="text-sm text-gray-300 max-w-md">
        Manage your subscription, update your payment method, or cancel your plan
        at any time through Stripe&apos;s secure billing portal.
      </p>
      <button
        onClick={openBillingPortal}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#7affc9] to-[#3af1f7] text-black text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        <span>
          {loading ? 'Opening billing portal…' : 'Manage / Cancel Subscription'}
        </span>
      </button>
    </section>
  )
}
