'use client'

import { useState, useEffect } from 'react'
import { Loader2, XCircle, AlertTriangle, CreditCard, Calendar as CalendarIcon } from 'lucide-react'
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
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-lime-400"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Billing</h2>
        <p className="text-sm text-gray-400">Manage your subscription and billing information</p>
      </div>

      {/* Current Plan Card */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-lime-500/20 rounded-lg">
            <CreditCard className="w-5 h-5 text-lime-400" />
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Current Plan</p>
          </div>
        </div>
        <p className="text-xl font-bold mb-1">
          {hasSub ? 'Corva Pro' : 'No active subscription'}
        </p>
        {hasSub && <p className="text-sm text-gray-400">1 active subscription</p>}
      </div>

      {/* Payment Details Card */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-emerald-500/20 rounded-lg">
            <CalendarIcon className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Payment Details</p>
        </div>

        {!hasSub ? (
          <p className="text-sm text-gray-300">
            You don&apos;t have an active subscription right now.
          </p>
        ) : (
          <div className="space-y-3">
            {cancelAtPeriodEnd ? (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <p className="text-sm text-amber-200">
                  Your plan will end on{' '}
                  <span className="font-semibold">{renewDateText ?? 'the current period end date'}</span>.
                  You won&apos;t be charged again.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <p className="text-sm text-emerald-200">
                  Your plan will automatically renew on{' '}
                  <span className="font-semibold">{renewDateText ?? 'the current period end date'}</span>.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
              <span className="text-sm text-gray-400">Billing Amount</span>
              <span className="text-lg font-semibold">
                {amountText ?? 'the plan price'} / {intervalLabel}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Manage Subscription Card */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Manage Subscription</h3>
          <p className="text-sm text-gray-400">
            {!cancelAtPeriodEnd
              ? 'You can cancel your subscription at any time. Access will remain until the end of your current billing period.'
              : 'Your subscription is scheduled to cancel at the end of the current billing period.'}
          </p>
        </div>

        <button
          onClick={cancelAtPeriodEnd ? handleResumeClick : handleCancelClick}
          disabled={loadingAction || !hasSub}
          className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            cancelAtPeriodEnd
              ? 'bg-gradient-to-r from-lime-400 to-emerald-400 text-black hover:shadow-lg hover:shadow-lime-400/20'
              : 'bg-gradient-to-r from-rose-500 to-red-500 text-white hover:shadow-lg hover:shadow-rose-500/20'
          }`}
        >
          {loadingAction && <Loader2 className="h-4 w-4 animate-spin" />}
          <span>
            {loadingAction
              ? 'Processing…'
              : cancelAtPeriodEnd
              ? 'Resume Subscription'
              : 'Cancel Subscription'}
          </span>
        </button>

        <p className="text-xs text-gray-500">
          You can&apos;t change plans in the app yet. We&apos;re working on adding this feature.
        </p>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={handleCloseModal}
          />
          <div className="relative z-50 w-full max-w-md bg-[#1a1f1b] border border-white/10 rounded-2xl shadow-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-amber-400" />
              </div>
              <div className="flex-1">
                <h4 className="text-xl font-bold mb-2">Cancel subscription?</h4>
                <p className="text-sm text-gray-300">
                  If you cancel now, you&apos;ll keep access until the end of your current billing period. You can subscribe again later if you change your mind.
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                disabled={loadingAction}
                className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-6 flex flex-col sm:flex-row justify-end gap-3">
              <button
                onClick={handleCloseModal}
                disabled={loadingAction}
                className="px-6 py-3 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 transition-all disabled:opacity-50 font-medium"
              >
                Never mind
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={loadingAction}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-red-500 text-white font-semibold hover:shadow-lg hover:shadow-rose-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingAction && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Yes, cancel it</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resume Confirmation Modal */}
      {showResumeConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={handleCloseModal}
          />
          <div className="relative z-50 w-full max-w-md bg-[#1a1f1b] border border-white/10 rounded-2xl shadow-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-emerald-400" />
              </div>
              <div className="flex-1">
                <h4 className="text-xl font-bold mb-2">Resume subscription?</h4>
                <p className="text-sm text-gray-300">
                  You are scheduled to cancel your subscription at the end of the period. Do you want to resume auto-billing?
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                disabled={loadingAction}
                className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-6 flex flex-col sm:flex-row justify-end gap-3">
              <button
                onClick={handleCloseModal}
                disabled={loadingAction}
                className="px-6 py-3 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 transition-all disabled:opacity-50 font-medium"
              >
                Never mind
              </button>
              <button
                onClick={handleConfirmResume}
                disabled={loadingAction}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-lime-400 to-emerald-400 text-black font-semibold hover:shadow-lg hover:shadow-lime-400/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingAction && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Yes, resume</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}