'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, CreditCard, Clock, AlertTriangle } from 'lucide-react'

export type TrialPromptMode = 'soft' | 'urgent' | 'strong'

interface TrialPromptModalProps {
  isOpen: boolean
  mode: TrialPromptMode
  daysRemaining: number
  onAddCard: () => void
  onDismiss?: () => void // Not available for 'strong' mode
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
        title: 'Add a card to keep Auto-Fill running after your trial.',
        subtitle: null,
        primaryButton: 'Add Card',
        secondaryButton: 'Not Now',
        showClose: true,
      }
    case 'urgent':
      return {
        icon: Clock,
        iconColor: COLORS.yellow,
        iconGlow: COLORS.yellowGlow,
        title: `Only ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left on your trial.`,
        subtitle: 'Add a card to avoid interruption.',
        primaryButton: 'Add Card',
        secondaryButton: 'Remind Me Later',
        showClose: true,
      }
    case 'strong':
      return {
        icon: AlertTriangle,
        iconColor: COLORS.red,
        iconGlow: COLORS.redGlow,
        title: 'Your trial has ended.',
        subtitle: 'Add a payment method to continue using Corva.',
        primaryButton: 'Add Card',
        secondaryButton: null,
        showClose: false,
      }
  }
}

export default function TrialPromptModal({
  isOpen,
  mode,
  daysRemaining,
  onAddCard,
  onDismiss,
}: TrialPromptModalProps) {
  const config = getModeConfig(mode, daysRemaining)
  const Icon = config.icon

  // For strong mode, prevent closing
  const handleBackdropClick = () => {
    if (mode !== 'strong' && onDismiss) {
      onDismiss()
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)' }}
          onClick={handleBackdropClick}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${COLORS.cardBg} 0%, #1c1e1c 100%)`,
              border: `1px solid ${COLORS.glassBorder}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button - only for soft/urgent */}
            {config.showClose && onDismiss && (
              <button
                onClick={onDismiss}
                className="absolute top-4 right-4 p-2 rounded-full transition-colors hover:bg-white/10"
                style={{ color: COLORS.textMuted }}
              >
                <X size={20} />
              </button>
            )}

            {/* Content */}
            <div className="p-6 md:p-8 text-center">
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

              {/* Buttons */}
              <div className="flex flex-col gap-3">
                {/* Primary button */}
                <button
                  onClick={onAddCard}
                  className="w-full py-3 px-6 rounded-xl font-semibold transition-all duration-200 hover:scale-[1.02]"
                  style={{
                    background: `linear-gradient(135deg, ${COLORS.green} 0%, #5b8f52 100%)`,
                    color: '#000',
                    boxShadow: `0 4px 16px ${COLORS.greenGlow}`,
                  }}
                >
                  {config.primaryButton}
                </button>

                {/* Secondary button - only for soft/urgent */}
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

              {/* Trial info for strong mode */}
              {mode === 'strong' && (
                <p
                  className="mt-4 text-xs"
                  style={{ color: COLORS.textMuted }}
                >
                  Your data is safe. Add a card to pick up where you left off.
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
