'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CreditCard, Clock, AlertTriangle, Loader2, Check, ArrowLeft } from 'lucide-react'
import { loadStripe } from '@stripe/stripe-js'
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js'
import toast from 'react-hot-toast'

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string
)

export type TrialPromptMode = 'soft' | 'urgent' | 'strong'
type SelectedPlan = 'monthly' | 'yearly'

interface TrialPromptModalProps {
  isOpen: boolean
  mode: TrialPromptMode
  daysRemaining: number
  onAddCard: () => void
  onDismiss?: () => void
}

// Status tone per mode: sage = healthy, warn = muted sand, danger = muted coral.
const TONE_CLASSES = {
  sage: 'bg-sage/[0.12] text-sage-bright',
  warn: 'bg-[#FFC97A]/[0.12] text-[#FFC97A]',
  danger: 'bg-[#FF8F7D]/[0.12] text-[#FF8F7D]',
} as const

const getModeConfig = (mode: TrialPromptMode, daysRemaining: number) => {
  switch (mode) {
    case 'soft':
      return {
        icon: CreditCard,
        tone: 'sage' as const,
        title: `Your trial ends in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`,
        subtitle: 'Add a payment method to keep Auto-Fill sending reminders and filling your open slots. No charge until your trial ends.',
        primaryButton: 'Subscribe Now',
        secondaryButton: 'Not Now',
        showClose: true,
      }
    case 'urgent':
      return {
        icon: Clock,
        tone: 'warn' as const,
        title: `Only ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left on your trial.`,
        subtitle: 'After your trial, Auto-Fill will pause. Subscribe now to keep your bookings coming in.',
        primaryButton: 'Subscribe Now',
        secondaryButton: 'Remind Me Later',
        showClose: true,
      }
    case 'strong':
      return {
        icon: AlertTriangle,
        tone: 'danger' as const,
        title: 'Your trial has ended.',
        subtitle: 'Auto-Fill is paused. Subscribe now to pick up right where you left off — your data is safe.',
        primaryButton: 'Subscribe Now',
        secondaryButton: null,
        showClose: false,
      }
  }
}

export default function TrialPromptModal({
  isOpen,
  mode,
  daysRemaining,
  onDismiss,
}: TrialPromptModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlan>('monthly')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)

  const config = getModeConfig(mode, daysRemaining)
  const Icon = config.icon

  const handleBackdropClick = () => {
    if (mode !== 'strong' && onDismiss && !showCheckout) {
      onDismiss()
    }
  }

  const handleSubscribe = async () => {
    try {
      setLoading(true)

      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: selectedPlan }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start checkout')
      }

      if (!data.clientSecret) {
        throw new Error('No clientSecret in response')
      }

      setClientSecret(data.clientSecret)
      setShowCheckout(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not start checkout'
      console.error(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const handleCloseCheckout = () => {
    setShowCheckout(false)
    setClientSecret(null)
  }

  const planOptionClass = (active: boolean) =>
    `flex-1 rounded-lg border p-3 text-left transition-colors ${
      active
        ? 'border-sage/45 bg-sage/[0.06]'
        : 'border-white/[0.07] bg-canvas hover:border-white/[0.12]'
    }`

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="modal-backdrop z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={handleBackdropClick}
        >
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
            className={`modal-surface relative w-full ${showCheckout ? 'max-w-xl' : 'max-w-md'} my-auto max-h-[90vh] overflow-y-auto`}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-3.5">
              <div className="flex min-w-0 items-center gap-2">
                {showCheckout && mode !== 'strong' && (
                  <button
                    onClick={handleCloseCheckout}
                    className="btn btn-ghost btn-sm !h-8 !px-2 -ml-2"
                    aria-label="Back to plans"
                  >
                    <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                )}
                <h2 className="panel-title truncate">
                  {showCheckout
                    ? `Secure checkout · ${selectedPlan === 'monthly' ? 'Monthly' : 'Yearly'} plan`
                    : mode === 'strong'
                    ? 'Trial ended'
                    : 'Your trial'}
                </h2>
              </div>
              {config.showClose && onDismiss && !showCheckout && (
                <button
                  onClick={onDismiss}
                  className="btn btn-ghost btn-sm !h-8 !w-8 !p-0"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" strokeWidth={1.75} />
                </button>
              )}
            </div>

            {!showCheckout ? (
              // Initial prompt view
              <>
                <div className="px-5 py-5">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONE_CLASSES[config.tone]}`}>
                      <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-ivory">{config.title}</p>
                      {config.subtitle && (
                        <p className="mt-1 text-sm text-gray-400">{config.subtitle}</p>
                      )}
                    </div>
                  </div>

                  {/* Plan selector */}
                  <div className="mt-5 flex gap-3" role="radiogroup" aria-label="Plan">
                    <button
                      onClick={() => setSelectedPlan('monthly')}
                      role="radio"
                      aria-checked={selectedPlan === 'monthly'}
                      className={planOptionClass(selectedPlan === 'monthly')}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[13px] font-medium text-gray-300">Monthly</span>
                        {selectedPlan === 'monthly' && <Check className="h-4 w-4 text-sage" strokeWidth={2} />}
                      </div>
                      <span className="text-lg font-semibold tabular-nums text-ivory">$20</span>
                      <span className="text-xs text-gray-500">/month</span>
                    </button>

                    <button
                      onClick={() => setSelectedPlan('yearly')}
                      role="radio"
                      aria-checked={selectedPlan === 'yearly'}
                      className={planOptionClass(selectedPlan === 'yearly')}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-[13px] font-medium text-gray-300">
                          Yearly
                          <span className="badge badge-sage">Save $20</span>
                        </span>
                        {selectedPlan === 'yearly' && <Check className="h-4 w-4 text-sage" strokeWidth={2} />}
                      </div>
                      <span className="text-lg font-semibold tabular-nums text-ivory">$220</span>
                      <span className="text-xs text-gray-500">/year</span>
                    </button>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex flex-col-reverse gap-2 border-t border-white/[0.07] px-5 py-4 sm:flex-row sm:justify-end">
                  {config.secondaryButton && onDismiss && (
                    <button onClick={onDismiss} className="btn btn-ghost btn-sm">
                      {config.secondaryButton}
                    </button>
                  )}
                  <button
                    onClick={handleSubscribe}
                    disabled={loading}
                    className="btn btn-primary btn-sm"
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {loading ? 'Loading...' : config.primaryButton}
                  </button>
                </div>
              </>
            ) : (
              // Checkout view
              <div className="p-4 md:p-5">
                {clientSecret && (
                  <EmbeddedCheckoutProvider
                    stripe={stripePromise}
                    options={{ clientSecret }}
                  >
                    <div className="min-h-[360px]">
                      <EmbeddedCheckout />
                    </div>
                  </EmbeddedCheckoutProvider>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
