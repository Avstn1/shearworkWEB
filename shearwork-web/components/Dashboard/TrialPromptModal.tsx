'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CreditCard, Clock, AlertTriangle, Loader2, Check } from 'lucide-react'
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

const COLORS = {
  background: '#181818',
  cardBg: '#1a1a1a',
  surface: 'rgba(37, 37, 37, 0.6)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
  text: '#FFFFFF',
  textMuted: 'rgba(255, 255, 255, 0.6)',
  green: '#73aa57',
  greenGlow: 'rgba(115, 170, 87, 0.4)',
  yellow: '#f5e29a',
  yellowGlow: 'rgba(245, 226, 154, 0.4)',
  red: '#ef4444',
  redGlow: 'rgba(239, 68, 68, 0.4)',
}

const getModeConfig = (mode: TrialPromptMode, daysRemaining: number) => {
  switch (mode) {
    case 'soft':
      return {
        icon: CreditCard,
        iconColor: COLORS.green,
        iconGlow: COLORS.greenGlow,
        title: `Your trial ends in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`,
        subtitle: 'Add a payment method to keep Auto-Fill sending reminders and filling your open slots. No charge until your trial ends.',
        primaryButton: 'Subscribe Now',
        secondaryButton: 'Not Now',
        showClose: true,
      }
    case 'urgent':
      return {
        icon: Clock,
        iconColor: COLORS.yellow,
        iconGlow: COLORS.yellowGlow,
        title: `Only ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left on your trial.`,
        subtitle: 'After your trial, Auto-Fill will pause. Subscribe now to keep your bookings coming in.',
        primaryButton: 'Subscribe Now',
        secondaryButton: 'Remind Me Later',
        showClose: true,
      }
    case 'strong':
      return {
        icon: AlertTriangle,
        iconColor: COLORS.red,
        iconGlow: COLORS.redGlow,
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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)' }}
          onClick={handleBackdropClick}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[90vh] overflow-y-auto"
            style={{
              background: `linear-gradient(135deg, ${COLORS.cardBg} 0%, #1c1e1c 100%)`,
              border: `1px solid ${COLORS.glassBorder}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button - only for soft/urgent when not in checkout */}
            {config.showClose && onDismiss && !showCheckout && (
              <button
                onClick={onDismiss}
                className="absolute top-4 right-4 p-2 rounded-full transition-colors hover:bg-white/10 z-10"
                style={{ color: COLORS.textMuted }}
              >
                <X size={20} />
              </button>
            )}

            {/* Back button when in checkout */}
            {showCheckout && mode !== 'strong' && (
              <button
                onClick={handleCloseCheckout}
                className="absolute top-4 left-4 p-2 rounded-full transition-colors hover:bg-white/10 z-10 flex items-center gap-1 text-sm"
                style={{ color: COLORS.textMuted }}
              >
                ← Back
              </button>
            )}

            {/* Content */}
            <div className="p-6 md:p-8">
              {!showCheckout ? (
                // Initial prompt view
                <div className="text-center">
                  {/* Icon */}
                  <div
                    className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6"
                    style={{
                      backgroundColor: `${config.iconColor}20`,
                      boxShadow: `0 0 24px ${config.iconGlow}`,
                    }}
                  >
                    <Icon size={32} style={{ color: config.iconColor }} />
                  </div>

                  {/* Title */}
                  <h2
                    className="text-xl md:text-2xl font-bold mb-2"
                    style={{ color: COLORS.text }}
                  >
                    {config.title}
                  </h2>

                  {/* Subtitle */}
                  {config.subtitle && (
                    <p
                      className="text-sm md:text-base mb-6"
                      style={{ color: COLORS.textMuted }}
                    >
                      {config.subtitle}
                    </p>
                  )}

                  {!config.subtitle && <div className="mb-6" />}

                  {/* Plan selector */}
                  <div className="flex gap-3 mb-4">
                    <button
                      onClick={() => setSelectedPlan('monthly')}
                      className="flex-1 p-3 rounded-xl border-2 transition-all text-left"
                      style={{
                        borderColor: selectedPlan === 'monthly' ? COLORS.green : COLORS.glassBorder,
                        backgroundColor: selectedPlan === 'monthly' ? `${COLORS.green}10` : 'transparent',
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold" style={{ color: COLORS.text }}>Monthly</span>
                        {selectedPlan === 'monthly' && <Check size={16} style={{ color: COLORS.green }} />}
                      </div>
                      <span className="text-lg font-bold" style={{ color: COLORS.green }}>$20</span>
                      <span className="text-xs" style={{ color: COLORS.textMuted }}>/month</span>
                    </button>

                    <button
                      onClick={() => setSelectedPlan('yearly')}
                      className="flex-1 p-3 rounded-xl border-2 transition-all text-left relative"
                      style={{
                        borderColor: selectedPlan === 'yearly' ? COLORS.yellow : COLORS.glassBorder,
                        backgroundColor: selectedPlan === 'yearly' ? `${COLORS.yellow}10` : 'transparent',
                      }}
                    >
                      <div className="absolute -top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: COLORS.yellow, color: '#000' }}>
                        Save $20
                      </div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold" style={{ color: COLORS.text }}>Yearly</span>
                        {selectedPlan === 'yearly' && <Check size={16} style={{ color: COLORS.yellow }} />}
                      </div>
                      <span className="text-lg font-bold" style={{ color: COLORS.yellow }}>$220</span>
                      <span className="text-xs" style={{ color: COLORS.textMuted }}>/year</span>
                    </button>
                  </div>

                  {/* Buttons */}
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={handleSubscribe}
                      disabled={loading}
                      className="w-full py-3 px-6 rounded-xl font-semibold transition-all duration-200 hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      style={{
                        background: `linear-gradient(135deg, ${COLORS.green} 0%, #5b8f52 100%)`,
                        color: '#000',
                        boxShadow: `0 4px 16px ${COLORS.greenGlow}`,
                      }}
                    >
                      {loading && <Loader2 size={18} className="animate-spin" />}
                      {loading ? 'Loading...' : config.primaryButton}
                    </button>

                    {config.secondaryButton && onDismiss && (
                      <button
                        onClick={onDismiss}
                        className="w-full py-3 px-6 rounded-xl font-medium transition-all duration-200 hover:bg-white/5"
                        style={{
                          color: COLORS.textMuted,
                          border: `1px solid ${COLORS.glassBorder}`,
                        }}
                      >
                        {config.secondaryButton}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                // Checkout view
                <div>
                  <h2 className="text-sm font-semibold text-gray-100 mb-4 text-center">
                    Secure checkout • {selectedPlan === 'monthly' ? 'Monthly' : 'Yearly'} plan
                  </h2>

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
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
