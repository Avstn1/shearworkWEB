import { motion } from 'framer-motion'
import { EyeOff, CheckCircle, X } from 'lucide-react'

interface PublishConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  currentStatus: boolean
}

export default function PublishConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  currentStatus,
}: PublishConfirmationModalProps) {
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
        className="modal-surface w-full max-w-md"
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
          <div className="flex items-center gap-2.5">
            {currentStatus ? (
              <EyeOff size={18} strokeWidth={1.75} className="shrink-0 text-amber-300" />
            ) : (
              <CheckCircle size={18} strokeWidth={1.75} className="shrink-0 text-sage" />
            )}
            <h3 className="text-[15px] font-semibold text-ivory">
              {currentStatus ? 'Unpublish Feature Update?' : 'Publish Feature Update?'}
            </h3>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm !h-8 !w-8 !p-0" aria-label="Close">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-gray-300">
            {currentStatus
              ? 'This update will no longer be visible to users. You can re-publish it anytime.'
              : 'This update will be immediately visible to all users in the feature updates modal.'}
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-white/[0.07] px-5 py-3">
          <button onClick={onClose} className="btn btn-glass btn-sm">
            Cancel
          </button>
          <button onClick={onConfirm} className="btn btn-primary btn-sm">
            {currentStatus ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
