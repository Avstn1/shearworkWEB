import { motion, AnimatePresence } from 'framer-motion';
import { Send, AlertCircle, X } from 'lucide-react';

interface TestMessageConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  availableCredits: number;
  profilePhone: string | null;
}

export default function TestMessageConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  availableCredits,
  profilePhone
}: TestMessageConfirmModalProps) {
  const hasInsufficientCredits = availableCredits < 1;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="modal-backdrop flex items-center justify-center p-4 min-h-screen"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="modal-surface max-w-md w-full"
          >
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/[0.07]">
              <div className="flex items-center gap-2.5 min-w-0">
                <Send className="w-[18px] h-[18px] text-sage flex-shrink-0" strokeWidth={1.75} />
                <h3 className="text-[15px] font-semibold text-ivory">
                  <span className="hidden sm:inline">Send test message</span>
                  <span className="sm:hidden">Test message</span>
                </h3>
              </div>
              <button onClick={onClose} className="btn btn-ghost btn-sm !h-8 !px-2" aria-label="Close">
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-muted">
                Each test message costs <span className="text-ivory font-semibold">1 credit</span>.
              </p>

              <div className="flex flex-wrap items-center gap-2 p-3 bg-white/[0.03] border border-white/[0.07] rounded-lg text-[13px] text-gray-300">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-gray-500" strokeWidth={1.75} />
                <p>
                  Available credits: <span className="font-semibold text-ivory tabular-nums">{availableCredits}</span>
                </p>
                {hasInsufficientCredits && (
                  <span className="badge badge-danger">Insufficient credits</span>
                )}
              </div>

              <div className="p-3 bg-white/[0.03] border border-white/[0.07] rounded-lg">
                <p className="text-xs text-muted mb-1">Test message will be sent to</p>
                <p className="text-sm text-ivory break-all tabular-nums">{profilePhone || 'Your registered phone number'}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-white/[0.07]">
              <button onClick={onClose} className="btn btn-ghost btn-sm">
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={hasInsufficientCredits}
                className="btn btn-primary btn-sm"
              >
                <span className="hidden sm:inline">Send (1 Credit)</span>
                <span className="sm:hidden">Send</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
