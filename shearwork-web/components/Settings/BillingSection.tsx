'use client'

import { useState, useEffect } from 'react'
import { Loader2, XCircle, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/utils/supabaseClient'

export default function BillingSection() {
  const [loading, setLoading] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showResumeConfirm, setShowResumeConfirm] = useState(false)
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState<boolean | null>(null)

  useEffect(() => {
    const fetchProfile = async () => {
      // ⭐ 1. Get the authenticated user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        console.error('Failed to load user:', userError)
        setCancelAtPeriodEnd(false)
        return
      }

      // ⭐ 2. Fetch THEIR profile row
      const { data, error } = await supabase
        .from('profiles')
        .select('cancel_at_period_end')
        .eq('user_id', user.id)   // <-- THIS was missing
        .maybeSingle()

      if (error) {
        console.error('Failed to fetch profile:', error)
        setCancelAtPeriodEnd(false)
      } else {
        console.log(data?.cancel_at_period_end)
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
      setCancelAtPeriodEnd(true)
      setShowCancelConfirm(false)
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
      setCancelAtPeriodEnd(false)
      setShowResumeConfirm(false)
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

      <p className="text-sm text-gray-300 max-w-md">
        {!cancelAtPeriodEnd
          ? 'You may cancel your subscription at any time. After cancellation, access will remain until the end of the current billing period.'
          : 'Your subscription is scheduled to cancel at the end of the billing period.'}
      </p>

      <button
        onClick={cancelAtPeriodEnd ? handleResumeClick : handleCancelClick}
        disabled={loading}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-black text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed ${
          cancelAtPeriodEnd
            ? 'bg-gradient-to-r from-[#6bff9f] to-[#6bff6b]'
            : 'bg-gradient-to-r from-[#ff9f9f] to-[#ff6b6b]'
        }`}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        <span>{loading ? 'Processing…' : cancelAtPeriodEnd ? 'Resume Auto-Billing' : 'Cancel Subscription'}</span>
      </button>

      {showCancelConfirm && (
        <ConfirmationModal
          title="Cancel subscription?"
          iconColor="text-amber-400"
          description="If you cancel now, you'll keep access until the end of your current billing period. You can subscribe again later if you change your mind."
          onConfirm={handleConfirmCancel}
          onClose={handleCloseModal}
          loading={loading}
          confirmText="Yes, cancel it"
        />
      )}

      {showResumeConfirm && (
        <ConfirmationModal
          title="Resume subscription?"
          iconColor="text-green-400"
          description="You are scheduled to cancel your subscription at the end of the period. Do you want to resume auto-billing?"
          onConfirm={handleConfirmResume}
          onClose={handleCloseModal}
          loading={loading}
          confirmText="Yes, resume"
        />
      )}
    </section>
  )
}


function ConfirmationModal({
  title,
  description,
  iconColor,
  onConfirm,
  onClose,
  loading,
  confirmText,
}: {
  title: string
  description: string
  iconColor: string
  onConfirm: () => void
  onClose: () => void
  loading: boolean
  confirmText: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md mx-4 rounded-2xl bg-[#141414] border border-white/10 shadow-2xl p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className={`h-6 w-6 mt-1 ${iconColor}`} />
          <div className="flex-1">
            <h4 className="text-lg font-semibold mb-1">{title}</h4>
            <p className="text-sm text-gray-300 mb-2">{description}</p>
          </div>
          <button onClick={onClose} disabled={loading} className="text-gray-400 hover:text-gray-200 disabled:opacity-50">
            <XCircle className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-5 flex flex-col sm:flex-row justify-end gap-3">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 rounded-xl border border-white/15 bg-white/5 text-sm text-gray-200 hover:bg-white/10 disabled:opacity-50">
            Never mind
          </button>
          <button onClick={onConfirm} disabled={loading} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#6bff9f] to-[#6bff6b] text-black text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
