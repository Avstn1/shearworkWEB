import { motion } from 'framer-motion'
import { AlertTriangle, ArrowRight, X } from 'lucide-react'

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
            <h3 className="text-[15px] font-semibold text-ivory">Version Change Detected</h3>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm !h-8 !w-8 !p-0" aria-label="Close">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
        <div className="px-5 py-4">
          {isEditingToNew ? (
            <p className="text-sm text-gray-300">
              You&apos;re currently editing an existing update, but version <span className="font-mono font-semibold text-ivory">{version}</span> doesn&apos;t exist yet.
              <br /><br />
              Do you want to switch to <span className="font-semibold text-ivory">create mode</span> to add this as a new update?
            </p>
          ) : (
            <p className="text-sm text-gray-300">
              Version <span className="font-mono font-semibold text-ivory">{version}</span> already exists in the database.
              <br /><br />
              Do you want to switch to <span className="font-semibold text-ivory">edit mode</span> for the existing update instead?
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-white/[0.07] px-5 py-3">
          <button onClick={onClose} className="btn btn-glass btn-sm">
            Cancel
          </button>
          <button onClick={onConfirm} className="btn btn-primary btn-sm">
            {isEditingToNew ? 'Switch to Create' : 'Switch to Edit'}
            <ArrowRight size={16} strokeWidth={1.75} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
