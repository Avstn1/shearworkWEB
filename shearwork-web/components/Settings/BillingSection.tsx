'use client'

import { useState } from 'react'
import { Loader2, XCircle, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function BillingSection() {
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleCancelClick = () => {
    setShowConfirm(true)
  }

  const handleConfirmCancel = async () => {
    setLoading(true)
    const toastId = toast.loading('Cancelling subscription…')

    try {
      const res = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to cancel subscription')
      }

      toast.success('Your subscription has been cancelled.', { id: toastId })
      setShowConfirm(false)
      // optionally: trigger a refresh or state update elsewhere
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Something went wrong.', { id: toastId })
    } finally {
      setLoading(false)
    }
  }

  const handleCloseModal = () => {
    if (loading) return
    setShowConfirm(false)
  }

  return (
    <>
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Billing</h3>
        <p className="text-sm text-gray-300 max-w-md">
          You may cancel your subscription at any time. After cancellation, you
          will keep access until the end of your current billing period.
        </p>

        <button
          onClick={handleCancelClick}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#ff9f9f] to-[#ff6b6b] text-black text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          <span>{loading ? 'Cancelling…' : 'Cancel Subscription'}</span>
        </button>
      </section>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleCloseModal}
          />

          {/* Modal Card */}
          <div className="relative z-50 w-full max-w-md mx-4 rounded-2xl bg-[#141414] border border-white/10 shadow-2xl p-6">
            <div className="flex items-start gap-3">
              <div className="mt-1">
                <AlertTriangle className="h-6 w-6 text-amber-400" />
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-semibold mb-1">
                  Cancel subscription?
                </h4>
                <p className="text-sm text-gray-300 mb-2">
                  If you cancel now, you&apos;ll keep access until the end of your
                  current billing period. After that, you&apos;ll lose access to
                  ShearWork&apos;s analytics dashboard.
                </p>
                <p className="text-xs text-gray-400">
                  You can always subscribe again later if you change your mind.
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                disabled={loading}
                className="text-gray-400 hover:text-gray-200 disabled:opacity-50"
                aria-label="Close"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 flex flex-col sm:flex-row justify-end gap-3">
              <button
                onClick={handleCloseModal}
                disabled={loading}
                className="px-4 py-2 rounded-xl border border-white/15 bg-white/5 text-sm text-gray-200 hover:bg-white/10 disabled:opacity-50"
              >
                Never mind
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#ff9f9f] to-[#ff6b6b] text-black text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Yes, cancel it</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
