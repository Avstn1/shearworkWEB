import { motion } from 'framer-motion'
import { EyeOff, CheckCircle } from 'lucide-react'

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
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#1f2420] border border-[#55694b]/50 rounded-2xl p-6 max-w-md w-full shadow-2xl"
      >
        <div className="flex items-start gap-3 mb-4">
          {currentStatus ? (
            <EyeOff className="w-6 h-6 text-[#d4a574] flex-shrink-0 mt-1" />
          ) : (
            <CheckCircle className="w-6 h-6 text-[#a8d5ba] flex-shrink-0 mt-1" />
          )}
          <div>
            <h3 className="text-lg font-bold text-[#F1F5E9] mb-2">
              {currentStatus ? 'Unpublish Feature Update?' : 'Publish Feature Update?'}
            </h3>
            <p className="text-sm text-gray-300">
              {currentStatus 
                ? 'This update will no longer be visible to users. You can re-publish it anytime.'
                : 'This update will be immediately visible to all users in the feature updates modal.'}
            </p>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white transition-all duration-300"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#55694b]/60 hover:bg-[#6b8e4e]/70 text-[#F1F5E9] font-semibold transition-all duration-300"
          >
            {currentStatus ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}