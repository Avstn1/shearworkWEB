import { motion } from 'framer-motion'
import { AlertTriangle, ArrowRight } from 'lucide-react'

interface VersionConflictModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  version: string
  isEditingToNew: boolean // true if editing and changing to new version, false if creating and changing to existing
}

export default function VersionConflictModal({
  isOpen,
  onClose,
  onConfirm,
  version,
  isEditingToNew,
}: VersionConflictModalProps) {
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
          <AlertTriangle className="w-6 h-6 text-[#d4a574] flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-lg font-bold text-[#F1F5E9] mb-2">Version Change Detected</h3>
            {isEditingToNew ? (
              <p className="text-sm text-gray-300">
                You're currently editing an existing update, but version <span className="font-mono font-bold text-[#d4a574]">{version}</span> doesn't exist yet.
                <br /><br />
                Do you want to switch to <span className="font-bold">create mode</span> to add this as a new update?
              </p>
            ) : (
              <p className="text-sm text-gray-300">
                Version <span className="font-mono font-bold text-[#d4a574]">{version}</span> already exists in the database.
                <br /><br />
                Do you want to switch to <span className="font-bold">edit mode</span> for the existing update instead?
              </p>
            )}
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
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#55694b]/60 hover:bg-[#6b8e4e]/70 text-[#F1F5E9] font-semibold transition-all duration-300 flex items-center justify-center gap-2"
          >
            {isEditingToNew ? 'Switch to Create' : 'Switch to Edit'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}