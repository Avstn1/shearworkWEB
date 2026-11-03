'use client'

import { useState, useEffect } from 'react'
import { Loader2, X, AlertTriangle, CreditCard, RotateCcw, Calendar as CalendarIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { Panel } from '@/components/ui/AppKit'

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
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState<boolean | null>(null)
  const [summary, setSummary] = useState<BillingSummary | null>(null)

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

      toast.success('Your subscription will end at the end of the current billing period.', { id: toastId })
      setCancelAtPeriodEnd(true)
      setShowCancelConfirm(false)
      setSummary((prev) => prev ? { ...prev, cancel_at_period_end: true } : prev)
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

      toast.success('Your subscription will renew automatically.', { id: toastId })
      setCancelAtPeriodEnd(false)
      setShowResumeConfirm(false)
      setSummary((prev) => prev ? { ...prev, cancel_at_period_end: false } : prev)
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
  const intervalLabel = interval === 'year' ? 'year' : interval === 'month' ? 'month' : 'period'
  const amountText = summary?.price && formatAmount(summary.price.amount, summary.price.currency)
  const renewDateText = formatDate(summary?.current_period_end ?? null)

  if (loadingSummary && cancelAtPeriodEnd === null) {
    return (
      <div className="panel flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-sage" strokeWidth={1.75} />
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Plan + payment */}
      <Panel
        title="Billing"
        subtitle="Manage your subscription and billing information"
        actions={
          hasSub
            ? cancelAtPeriodEnd
              ? <span className="badge badge-warn">Ending</span>
              : <span className="badge badge-sage">Active</span>
            : <span className="badge">Inactive</span>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="stat-label flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5" strokeWidth={1.75} />
              Current plan
            </p>
            <p className="mt-2 text-lg font-semibold text-ivory">
              {hasSub ? 'Corva Pro' : 'No active subscription'}
            </p>
            {hasSub && <p className="mt-0.5 text-[13px] text-muted">1 active subscription</p>}
          </div>
          {hasSub && (
            <div>
              <p className="stat-label flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
                Billing amount
              </p>
              <p className="mt-2 text-lg font-semibold tabular-nums text-ivory">
                {amountText ?? 'the plan price'} <span className="text-sm font-normal text-muted">/ {intervalLabel}</span>
              </p>
            </div>
          )}
        </div>

        <hr className="divider my-5" />

        {!hasSub ? (
          <p className="text-sm text-gray-300">
            You don&apos;t have an active subscription right now.
          </p>
        ) : cancelAtPeriodEnd ? (
          <p className="text-sm text-amber-300">
            Your plan will end on{' '}
            <span className="font-semibold">{renewDateText ?? 'the current period end date'}</span>.
            You won&apos;t be charged again.
          </p>
        ) : (
          <p className="text-sm text-gray-300">
            Your plan will automatically renew on{' '}
            <span className="font-semibold text-ivory">{renewDateText ?? 'the current period end date'}</span>.
          </p>
        )}
      </Panel>

      {/* Manage Subscription */}
      <Panel title="Manage subscription">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm text-gray-300">
              {!cancelAtPeriodEnd
                ? 'You can cancel your subscription at any time. Access will remain until the end of your current billing period.'
                : 'Your subscription is scheduled to cancel at the end of the current billing period.'}
            </p>
            <p className="text-xs text-gray-500">
              You can&apos;t change plans in the app yet. We&apos;re working on adding this feature.
            </p>
          </div>

          <button
            onClick={cancelAtPeriodEnd ? handleResumeClick : handleCancelClick}
            disabled={loadingAction || !hasSub}
            className={`btn btn-sm shrink-0 self-end sm:self-auto ${
              cancelAtPeriodEnd ? 'btn-primary' : 'btn-glass text-[#FF8F7D]'
            }`}
          >
            {loadingAction && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />}
            <span>
              {loadingAction
                ? 'Processing…'
                : cancelAtPeriodEnd
                ? 'Resume Subscription'
                : 'Cancel Subscription'}
            </span>
          </button>
        </div>
      </Panel>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="modal-backdrop absolute z-0" onClick={handleCloseModal} />
        <div className="modal-surface relative z-50 w-full max-w-md overflow-hidden">
          <div className="panel-header">
            <div className="flex min-w-0 items-center gap-3">
              <AlertTriangle className="h-[18px] w-[18px] flex-shrink-0 text-amber-300" strokeWidth={1.75} />
              <h4 className="panel-title">Cancel subscription?</h4>
            </div>
            <button
              onClick={handleCloseModal}
              disabled={loadingAction}
              className="btn btn-ghost btn-sm h-8 w-8 p-0"
              aria-label="Close"
            >
              <X className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </button>
          </div>
          <p className="p-5 text-sm text-gray-300">
            If you cancel now, you&apos;ll keep access until the end of your current billing period. You can subscribe again later if you change your mind.
          </p>
          <div className="flex justify-end gap-2 border-t border-white/[0.07] px-5 py-3">
            <button onClick={handleCloseModal} disabled={loadingAction} className="btn btn-ghost btn-sm">
              Never mind
            </button>
            <button onClick={handleConfirmCancel} disabled={loadingAction} className="btn btn-sm bg-[#FF8F7D] text-ink hover:bg-[#FFA394]">
              {loadingAction && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />}
              <span>Yes, cancel it</span>
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Resume Confirmation Modal */}
      {showResumeConfirm && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="modal-backdrop absolute z-0" onClick={handleCloseModal} />
        <div className="modal-surface relative z-50 w-full max-w-md overflow-hidden">
          <div className="panel-header">
            <div className="flex min-w-0 items-center gap-3">
              <RotateCcw className="h-[18px] w-[18px] flex-shrink-0 text-sage-bright" strokeWidth={1.75} />
              <h4 className="panel-title">Resume subscription?</h4>
            </div>
            <button
              onClick={handleCloseModal}
              disabled={loadingAction}
              className="btn btn-ghost btn-sm h-8 w-8 p-0"
              aria-label="Close"
            >
              <X className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </button>
          </div>
          <p className="p-5 text-sm text-gray-300">
            You are scheduled to cancel your subscription at the end of the period. Do you want to resume auto-billing?
          </p>
          <div className="flex justify-end gap-2 border-t border-white/[0.07] px-5 py-3">
            <button onClick={handleCloseModal} disabled={loadingAction} className="btn btn-ghost btn-sm">
              Never mind
            </button>
            <button onClick={handleConfirmResume} disabled={loadingAction} className="btn btn-primary btn-sm">
              {loadingAction && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />}
              <span>Yes, resume</span>
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  )
}
