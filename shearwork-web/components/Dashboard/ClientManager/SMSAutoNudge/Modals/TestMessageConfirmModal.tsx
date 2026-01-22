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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-6"
          >
            {/* Header */}
            <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 bg-amber-300/20 text-amber-300">
                  <Send className="w-6 h-6" />
                </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white mb-2">
                  Send Test Message?
                </h3>
                <p className="text-sm text-[#bdbdbd]">
                  {profilePhone ? (
                    <>
                      A test SMS will be sent to <span className="text-white font-semibold">{profilePhone}</span>
                    </>
                  ) : (
                    'A test SMS will be sent to your registered phone number'
                  )}
                </p>
              </div>
            </div>

            {/* Cost Info */}
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-6">
              <div className="flex items-start gap-2 text-sm text-amber-300">
                <Coins className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-1">Test Message Cost</p>
                  <p className="text-amber-200">
                    Each test message costs <span className="font-semibold">1 credit</span>.
                    {hasInsufficientCredits && (
                      <span className="block mt-1 text-rose-300">
                        ⚠️ Insufficient credits. You need at least 1 credit.
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Info Note */}
            <div className="p-3 bg-white/5 border border-white/10 rounded-lg mb-6">
              <div className="flex items-start gap-2 text-xs text-[#bdbdbd]">
                <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                <p>
                  Test messages are sent immediately to help you verify message content and formatting before activating your campaign.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 rounded-xl font-bold bg-white/5 text-[#bdbdbd] hover:bg-white/10 hover:text-white transition-all duration-300 border border-white/10"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={hasInsufficientCredits}
                className="flex-1 px-4 py-3 rounded-xl font-bold transition-all duration-300 bg-amber-300/20 text-amber-300 border border-amber-300/30 hover:bg-amber-300/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send Test (1 Credit)
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
