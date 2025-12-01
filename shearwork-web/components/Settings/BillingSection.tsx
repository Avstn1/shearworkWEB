'use client'

import { useState, useEffect } from 'react'
import { Loader2, XCircle, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function BillingSection() {
  const supabase = createClientComponentClient()
  const [loading, setLoading] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showResumeConfirm, setShowResumeConfirm] = useState(false)
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState<boolean | null>(null)

  // fetch user's subscription status
  useEffect(() => {
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('cancel_at_period_end')
        .maybeSingle()

      if (error) {
        console.error('Failed to fetch profile:', error)
        setCancelAtPeriodEnd(false)
      } else {
        setCancelAtPeriodEnd(data?.cancel_at_period_end ?? false)
      }
    }
    fetchProfile()
  }, [])

  const handleCancelClick = () => setShowCancelConfirm(true)
  const handleResumeClick = () => setShowResumeConfirm(true)

  const handleConfirmCancel = async () => {
    setLoading(true)
    const toastId = toast.loading('Cancelling subscription…')

    try {
      const res = await fetch('/api/stripe/cancel-subscription', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to cancel subscription')

      toast.success('Your subscription will end at the end of the current billing period.', { id: toastId })
      setShowCancelConfirm(false)
      setCancelAtPeriodEnd(true)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Something went wrong.', { id: toastId })
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmResume = async () => {
    setLoading(true)
    const toastId = toast.loading('Resuming subscription…')

    try {
      const res = await fetch('/api/stripe/resume-subscription', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to resume subscription')

      toast.success('Your subscription will renew automatically.', { id: toastId })
      setShowResumeConfirm(false)
      setCancelAtPeriodEnd(false)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Something went wrong.', { id: toastId })
    } finally {
      setLoading(false)
    }
  }

  const handleCloseModal = () => {
    if (loading) return
    setShowCancelConfirm(false)
    setShowResumeConfirm(false)
  }

  if (cancelAtPeriodEnd === null) return <p>Loading…</p>

  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold">Billing</h3>

      {!cancelAtPeriodEnd ? (
        <>
          <p className="text-sm text-gray-300 max-w-md">
            You may cancel your subscription at any time. After cancellation, access will remain until the end of the current billing period.
          </p>
          <button
            onClick={handleCancelClick}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#ff9f9f] to-[#ff6b6b] text-black text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{loading ? 'Cancelling…' : 'Cancel Subscription'}</span>
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-300 max-w-md">
            Your subscription is scheduled to cancel at the end of the billing period.
          </p>
          <button
            onClick={handleResumeClick}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#6bff9f] to-[#6bff6b] text-black text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{loading ? 'Processing…' : 'Resume Auto-Billing'}</span>
          </button>
        </>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCloseModal} />
          <div className="relative z-50 w-full max-w-md mx-4 rounded-2xl bg-[#141414] border border-white/10 shadow-2xl p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-amber-400 mt-1" />
              <div className="flex-1">
                <h4 className="text-lg font-semibold mb-1">Cancel subscription?</h4>
                <p className="text-sm text-gray-300 mb-2">
                  If you cancel now, you'll keep access until the end of your current billing period.
                </p>
                <p className="text-xs text-gray-400">
                  You can subscribe again later if you change your mind.
                </p>
              </div>
              <button onClick={handleCloseModal} disabled={loading} className="text-gray-400 hover:text-gray-200 disabled:opacity-50">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 flex flex-col sm:flex-row justify-end gap-3">
              <button onClick={handleCloseModal} disabled={loading} className="px-4 py-2 rounded-xl border border-white/15 bg-white/5 text-sm text-gray-200 hover:bg-white/10 disabled:opacity-50">
                Never mind
              </button>
              <button onClick={handleConfirmCancel} disabled={loading} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#ff9f9f] to-[#ff6b6b] text-black text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Yes, cancel it</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resume Confirmation Modal */}
      {showResumeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCloseModal} />
          <div className="relative z-50 w-full max-w-md mx-4 rounded-2xl bg-[#141414] border border-white/10 shadow-2xl p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-green-400 mt-1" />
              <div className="flex-1">
                <h4 className="text-lg font-semibold mb-1">Resume subscription?</h4>
                <p className="text-sm text-gray-300 mb-2">
                  You are scheduled to cancel your subscription at the end of the period. Do you want to resume auto-billing?
                </p>
              </div>
              <button onClick={handleCloseModal} disabled={loading} className="text-gray-400 hover:text-gray-200 disabled:opacity-50">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 flex flex-col sm:flex-row justify-end gap-3">
              <button onClick={handleCloseModal} disabled={loading} className="px-4 py-2 rounded-xl border border-white/15 bg-white/5 text-sm text-gray-200 hover:bg-white/10 disabled:opacity-50">
                Never mind
              </button>
              <button onClick={handleConfirmResume} disabled={loading} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#6bff9f] to-[#6bff6b] text-black text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Yes, resume</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
