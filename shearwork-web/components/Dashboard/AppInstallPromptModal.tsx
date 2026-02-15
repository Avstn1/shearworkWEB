'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Smartphone } from 'lucide-react'

interface AppInstallPromptModalProps {
  isOpen: boolean
  onDismiss: () => void
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
}

// TODO: Replace with real App Store ID when available
const APP_STORE_URL = 'https://apps.apple.com/app/id000000000'

export default function AppInstallPromptModal({
  isOpen,
  onDismiss,
}: AppInstallPromptModalProps) {

  const handleBackdropClick = () => {
    onDismiss()
  }

  const handleAppStoreClick = () => {
    window.open(APP_STORE_URL, '_blank', 'noopener,noreferrer')
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
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="relative w-full max-w-md rounded-2xl shadow-2xl"
            style={{
              backgroundColor: COLORS.cardBg,
              border: `1px solid ${COLORS.glassBorder}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={onDismiss}
              className="absolute top-4 right-4 p-1 rounded-full transition-colors hover:bg-white/10"
              style={{ color: COLORS.textMuted }}
            >
              <X size={20} />
            </button>

            <div className="p-6 sm:p-8">
              {/* Icon */}
              <div className="flex justify-center mb-6">
                <div
                  className="p-4 rounded-2xl"
                  style={{
                    backgroundColor: COLORS.surface,
                    boxShadow: `0 0 40px ${COLORS.greenGlow}`,
                  }}
                >
                  <Smartphone size={32} style={{ color: COLORS.green }} />
                </div>
              </div>

              {/* Title */}
              <h2
                className="text-2xl sm:text-3xl font-bold text-center mb-4"
                style={{ color: COLORS.text }}
              >
                Don&apos;t miss bookings.
              </h2>

              {/* Body */}
              <p
                className="text-center mb-8 leading-relaxed"
                style={{ color: COLORS.textMuted }}
              >
                Corva is now filling your open spots. When someone books from a Corva reminder, you&apos;ll get an instant alert — so you can stay on top of your schedule.
              </p>

              {/* Primary Button */}
              <button
                onClick={handleAppStoreClick}
                className="w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  backgroundColor: COLORS.green,
                  color: '#FFFFFF',
                  boxShadow: `0 4px 20px ${COLORS.greenGlow}`,
                }}
              >
                Enable Booking Alerts
              </button>

              {/* Subtext */}
              <p
                className="text-center mt-3 text-sm"
                style={{ color: COLORS.textMuted }}
              >
                Takes 30 seconds
              </p>

              {/* Secondary Option */}
              <button
                onClick={onDismiss}
                className="w-full mt-6 py-3 px-6 text-sm transition-colors hover:underline"
                style={{ color: COLORS.textMuted }}
              >
                Continue without alerts
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
