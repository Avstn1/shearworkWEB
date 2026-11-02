import { motion } from 'framer-motion'
import { X, AlertTriangle } from 'lucide-react'

interface UnsavedChangesModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}

export default function UnsavedChangesModal({ isOpen, onClose, onConfirm }: UnsavedChangesModalProps) {
  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="modal-backdrop flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        onClick={(e) => e.stopPropagation()}
        className="modal-surface w-full max-w-md overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={18} strokeWidth={1.75} className="shrink-0 text-amber-300" />
            <h2 className="text-[15px] font-semibold text-ivory">Unsaved Changes</h2>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm !h-8 !w-8 !p-0" aria-label="Close">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-3 px-5 py-4">
          <p className="text-sm leading-relaxed text-gray-300">
            You have unsaved changes in the current feature update. Creating a new feature will discard these changes.
          </p>
          <p className="text-sm font-medium text-amber-300">Are you sure you want to continue?</p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 border-t border-white/[0.07] px-5 py-3">
          <button onClick={onClose} className="btn btn-glass btn-sm">
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className="btn btn-primary btn-sm"
          >
            Discard & Continue
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
