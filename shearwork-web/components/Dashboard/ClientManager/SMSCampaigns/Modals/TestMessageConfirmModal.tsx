import { motion, AnimatePresence } from 'framer-motion';
import { Send, AlertCircle } from 'lucide-react';

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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 min-h-screen"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-4 md:p-6"
          >
            <div className="flex items-start gap-3 md:gap-4 mb-4">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center flex-shrink-0 bg-amber-300/20 text-amber-300">
                <Send className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg md:text-xl font-bold text-white mb-2">
                  <span className="hidden sm:inline">Send Test Message</span>
                  <span className="sm:hidden">Test Message</span>
                </h3>
                <p className="text-xs md:text-sm text-[#bdbdbd]">
                  Each test message costs <span className="text-amber-300 font-semibold">1 credit</span>.
                </p>
              </div>
            </div>

            <div className="p-2.5 md:p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-4">
              <div className="flex items-center gap-2 text-xs md:text-sm text-amber-300">
                <AlertCircle className="w-3.5 h-3.5 md:w-4 md:h-4 flex-shrink-0" />
                <p>
                  Available credits: <span className="font-semibold">{availableCredits}</span>
                </p>
                {hasInsufficientCredits && (
                  <span className="text-rose-300">• Insufficient credits</span>
                )}
              </div>
            </div>

            <div className="p-3 md:p-4 bg-white/5 border border-white/10 rounded-lg mb-4 md:mb-6">
              <p className="text-xs md:text-sm text-white mb-1.5 md:mb-2">
                <span className="font-semibold">Test message will be sent to:</span>
              </p>
              <p className="text-xs md:text-sm text-sky-300 break-all">{profilePhone || 'Your registered phone number'}</p>
            </div>

            <div className="flex gap-2 md:gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-3 md:px-4 py-2.5 md:py-3 rounded-xl text-sm md:text-base font-bold bg-white/5 text-[#bdbdbd] hover:bg-white/10 hover:text-white transition-all duration-300 border border-white/10"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={hasInsufficientCredits}
                className="flex-1 px-3 md:px-4 py-2.5 md:py-3 rounded-xl text-sm md:text-base font-bold bg-gradient-to-r from-sky-300 to-lime-300 text-black hover:shadow-[0_0_20px_rgba(125,211,252,0.6)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
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
