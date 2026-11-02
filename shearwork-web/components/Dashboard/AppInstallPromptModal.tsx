'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Smartphone } from 'lucide-react'

interface AppInstallPromptModalProps {
  isOpen: boolean
  onDismiss: () => void
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
          className="modal-backdrop z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={handleBackdropClick}
        >
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="modal-surface relative w-full max-w-md"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sage/[0.12]">
                  <Smartphone className="h-4 w-4 text-sage-bright" strokeWidth={1.75} />
                </div>
                <h2 className="panel-title">Don&apos;t miss bookings.</h2>
              </div>
              <button
                onClick={onDismiss}
                className="btn btn-ghost btn-sm !h-8 !w-8 !p-0"
                aria-label="Close"
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-5">
              <p className="text-sm leading-relaxed text-gray-300">
                Corva is now filling your open spots. When someone books from a Corva reminder, you&apos;ll get an instant alert — so you can stay on top of your schedule.
              </p>
              <p className="mt-3 text-xs text-gray-500">Takes 30 seconds</p>
            </div>

            {/* Footer */}
            <div className="flex flex-col-reverse gap-2 border-t border-white/[0.07] px-5 py-4 sm:flex-row sm:justify-end">
              <button onClick={onDismiss} className="btn btn-ghost btn-sm">
                Continue without alerts
              </button>
              <button onClick={handleAppStoreClick} className="btn btn-primary btn-sm">
                Enable Booking Alerts
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
