'use client'

import { useState, useEffect } from 'react'
import { Loader2, XCircle, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

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

export default function BillingSection() {
  const [loadingAction, setLoadingAction] = useState(false)
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showResumeConfirm, setShowResumeConfirm] = useState(false)
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState<boolean | null>(
    null,
  )
  const [summary, setSummary] = useState<BillingSummary | null>(null)

  // Load billing summary (plan, amount, next renewal date, cancel flag)
  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setLoadingSummary(true)
        const res = await fetch('/api/stripe/billing-summary')
        const data = await res.json()

        if (!res.ok) {
          console.error('Failed to load billing summary:', data.error)
          setSummary(null)
          setCancelAtPeriodEnd(false)
          return
        }

        setSummary(data)
        setCancelAtPeriodEnd(data.cancel_at_period_end ?? false)
      } catch (err) {
        console.error('Billing summary error:', err)
        setSummary(null)
        setCancelAtPeriodEnd(false)
      } finally {
        setLoadingSummary(false)
      }
    }

    fetchSummary()
  }, [])

  const handleCancelClick = () => setShowCancelConfirm(true)
  const handleResumeClick = () => setShowResumeConfirm(true)

  const handleConfirmCancel = async () => {
    setLoadingAction(true)
    const toastId = toast.loading('Cancelling subscription…')

    try {
      const res = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to cancel subscription')

      toast.success(
        'Your subscription will end at the end of the current billing period.',
        { id: toastId },
      )
      setCancelAtPeriodEnd(true)
      setShowCancelConfirm(false)
      setSummary((prev) =>
        prev ? { ...prev, cancel_at_period_end: true } : prev,
      )
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Something went wrong.', { id: toastId })
    } finally {
      setLoadingAction(false)
    }
  }

  const handleConfirmResume = async () => {
    setLoadingAction(true)
    const toastId = toast.loading('Resuming subscription…')

    try {
      const res = await fetch('/api/stripe/resume-subscription', {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to resume subscription')

      toast.success('Your subscription will renew automatically.', {
        id: toastId,
      })
      setCancelAtPeriodEnd(false)
      setShowResumeConfirm(false)
      setSummary((prev) =>
        prev ? { ...prev, cancel_at_period_end: false } : prev,
      )
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Something went wrong.', { id: toastId })
    } finally {
      setLoadingAction(false)
    }
  }

  const handleCloseModal = () => {
    if (loadingAction) return
    setShowCancelConfirm(false)
    setShowResumeConfirm(false)
  }

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
    interval === 'year' ? 'year' : interval === 'month' ? 'month' : 'period'

  const amountText =
    summary?.price &&
    formatAmount(summary.price.amount, summary.price.currency)

  const renewDateText = formatDate(summary?.current_period_end ?? null)

  if (loadingSummary && cancelAtPeriodEnd === null) {
    return <p className="text-sm text-gray-300">Loading billing info…</p>
  }

  return (
    <section className="space-y-4">
      <h3 className="text-lg font-semibold">Billing</h3>

      {/* Current plan card */}
      <div className="rounded-2xl bg-[#141414] border border-white/10 p-4 flex flex-col gap-1">
        <p className="text-xs text-gray-400 uppercase tracking-wide">
          Current plan
        </p>
        <p className="text-base font-semibold">
          {hasSub ? 'Corva Pro' : 'No active subscription'}
        </p>
        {hasSub && (
          <p className="text-xs text-gray-400">1 active subscription</p>
        )}
      </div>

      {/* Payment card */}
      <div className="rounded-2xl bg-[#141414] border border-white/10 p-4 space-y-1">
        <p className="text-xs text-gray-400 uppercase tracking-wide">
          Payment
        </p>

        {!hasSub ? (
          <p className="text-sm text-gray-300">
            You don&apos;t have an active subscription right now.
          </p>
        ) : (
          <>
            {cancelAtPeriodEnd ? (
              <p className="text-sm text-gray-200">
                Your plan will end on{' '}
                <span className="font-semibold">
                  {renewDateText ?? 'the current period end date'}
                </span>
                . You won&apos;t be charged again.
              </p>
            ) : (
              <p className="text-sm text-gray-200">
                Your plan will automatically renew on{' '}
                <span className="font-semibold">
                  {renewDateText ?? 'the current period end date'}
                </span>
                .
              </p>
            )}

            <p className="text-sm text-gray-300">
              You&apos;ll be charged{' '}
              <span className="font-semibold">
                {amountText ?? 'the plan price'}
              </span>{' '}
              / {intervalLabel}.
            </p>
          </>
        )}
      </div>

      {/* Manage subscription card */}
      <div className="rounded-2xl bg-[#101010] border border-white/15 p-4 flex flex-col gap-3">
        <div>
          <p className="text-sm font-semibold">Manage subscription</p>
          <p className="text-xs text-gray-400">
            {!cancelAtPeriodEnd
              ? 'You can cancel your subscription at any time. Access will remain until the end of your current billing period.'
              : 'Your subscription is scheduled to cancel at the end of the current billing period.'}
          </p>
        </div>

        <div>
          <button
            onClick={
              cancelAtPeriodEnd ? handleResumeClick : handleCancelClick
            }
            disabled={loadingAction || !hasSub}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-black text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed ${
              cancelAtPeriodEnd
                ? 'bg-gradient-to-r from-[#6bff9f] to-[#6bff6b]'
                : 'bg-gradient-to-r from-[#ff9f9f] to-[#ff6b6b]'
            }`}
          >
            {loadingAction && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>
              {loadingAction
                ? 'Processing…'
                : cancelAtPeriodEnd
                ? 'Resume auto-billing'
                : 'Cancel subscription'}
            </span>
          </button>
        </div>

        <p className="text-[11px] text-gray-500">
          You can&apos;t change plans in the app yet. We know it&apos;s not
          ideal.
        </p>
      </div>

      {showCancelConfirm && (
        <ConfirmationModal
          title="Cancel subscription?"
          iconColor="text-amber-400"
          description="If you cancel now, you'll keep access until the end of your current billing period. You can subscribe again later if you change your mind."
          onConfirm={handleConfirmCancel}
          onClose={handleCloseModal}
          loading={loadingAction}
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
          loading={loadingAction}
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
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-50 w-full max-w-md mx-4 rounded-2xl bg-[#141414] border border-white/10 shadow-2xl p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className={`h-6 w-6 mt-1 ${iconColor}`} />
          <div className="flex-1">
            <h4 className="text-lg font-semibold mb-1">{title}</h4>
            <p className="text-sm text-gray-300 mb-2">{description}</p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-200 disabled:opacity-50"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-5 flex flex-col sm:flex-row justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl border border-white/15 bg-white/5 text-sm text-gray-200 hover:bg-white/10 disabled:opacity-50"
          >
            Never mind
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#6bff9f] to-[#6bff6b] text-black text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
