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
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-gradient-to-br from-[#1a1f1b] to-[#2e3b2b] border border-amber-500/50 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-amber-500/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            </div>
            <h2 className="text-xl font-bold text-[#F1F5E9]">
              Unsaved Changes
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-300 leading-relaxed mb-6">
            You have unsaved changes in the current feature update. Creating a new feature will discard these changes.
          </p>
          <p className="text-amber-400 text-sm font-semibold">
            Are you sure you want to continue?
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 bg-[#1a1f1b]/50 border-t border-[#55694b]/30">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold bg-[#2a2a2a] text-white/80 hover:text-white hover:bg-[#3a3a3a] transition-all duration-300"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 transition-all duration-300"
          >
            Discard & Continue
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}