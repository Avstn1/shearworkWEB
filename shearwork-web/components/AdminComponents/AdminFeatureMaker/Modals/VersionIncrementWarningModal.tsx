import { motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'

interface VersionIncrementWarningModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  version: string
  type: 'major' | 'minor'
}

export default function VersionIncrementWarningModal({
  isOpen,
  onClose,
  onConfirm,
  version,
  type,
}: VersionIncrementWarningModalProps) {
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
            <h3 className="text-lg font-bold text-[#F1F5E9] mb-2">
              {type === 'major' ? 'Major' : 'Minor'} Version Increment
            </h3>
            <p className="text-sm text-gray-300 mb-3">
              You're about to increment the {type} version to <span className="font-mono font-bold text-[#d4a574]">{version}</span>.
            </p>
            <div className="bg-[#2a2a2a] rounded-lg p-3 border border-[#55694b]/30">
              <p className="text-xs text-[#d4a574] font-semibold mb-1">⚠️ Important:</p>
              <p className="text-xs text-gray-400">
                Once you create this version, you cannot go back to create updates in the previous {type} version tier. 
                {type === 'major' 
                  ? ' All future updates must be in this new major version or higher.'
                  : ' All future updates must be in this new minor version or higher within the same major version.'}
              </p>
            </div>
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
            I Understand
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}