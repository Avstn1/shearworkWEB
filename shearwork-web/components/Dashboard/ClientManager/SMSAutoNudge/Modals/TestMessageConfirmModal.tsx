import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, AlertCircle, Coins } from 'lucide-react';

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
  profilePhone,
}: TestMessageConfirmModalProps) {
  const hasInsufficientCredits = availableCredits < 1;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="modal-backdrop flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="modal-surface max-w-md w-full"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/[0.07]">
              <div className="flex items-center gap-2.5 min-w-0">
                <Send className="w-[18px] h-[18px] text-sage flex-shrink-0" strokeWidth={1.75} />
                <h3 className="text-[15px] font-semibold text-ivory">Send test message?</h3>
              </div>
              <button onClick={onClose} className="btn btn-ghost btn-sm !h-8 !px-2" aria-label="Close">
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-muted">
                {profilePhone ? (
                  <>
                    A test SMS will be sent to <span className="text-ivory font-semibold tabular-nums">{profilePhone}</span>
                  </>
                ) : (
                  'A test SMS will be sent to your registered phone number'
                )}
              </p>

              {/* Cost Info */}
              <div className="flex items-start gap-2 p-3 bg-white/[0.03] border border-white/[0.07] rounded-lg text-[13px] text-gray-300">
                <Coins className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-500" strokeWidth={1.75} />
                <div className="space-y-1.5">
                  <p>
                    Each test message costs <span className="font-semibold text-ivory">1 credit</span>.
                  </p>
                  {hasInsufficientCredits && (
                    <span className="badge badge-danger">Insufficient credits. You need at least 1 credit.</span>
                  )}
                </div>
              </div>

              {/* Info Note */}
              <div className="flex items-start gap-2 text-xs text-gray-500">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                <p>
                  Test messages are sent immediately to help you verify message content and formatting before activating your campaign.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-white/[0.07]">
              <button onClick={onClose} className="btn btn-ghost btn-sm">
                Cancel
              </button>
              <button onClick={onConfirm} disabled={hasInsufficientCredits} className="btn btn-primary btn-sm">
                Send test (1 credit)
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
