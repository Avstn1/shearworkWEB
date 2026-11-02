import { motion } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'

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
            <AlertTriangle size={18} strokeWidth={1.75} className="shrink-0 text-amber-300" />
            <h3 className="text-[15px] font-semibold text-ivory">
              {type === 'major' ? 'Major' : 'Minor'} Version Increment
            </h3>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm !h-8 !w-8 !p-0" aria-label="Close">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <p className="text-sm text-gray-300">
            You&apos;re about to increment the {type} version to <span className="font-mono font-semibold text-ivory">{version}</span>.
          </p>
          <div className="rounded-lg border border-white/[0.07] bg-raised p-3">
            <p className="mb-1 text-xs font-semibold text-amber-300">Important</p>
            <p className="text-xs text-gray-400">
              Once you create this version, you cannot go back to create updates in the previous {type} version tier.
              {type === 'major'
                ? ' All future updates must be in this new major version or higher.'
                : ' All future updates must be in this new minor version or higher within the same major version.'}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-white/[0.07] px-5 py-3">
          <button onClick={onClose} className="btn btn-glass btn-sm">
            Cancel
          </button>
          <button onClick={onConfirm} className="btn btn-primary btn-sm">
            I Understand
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
