import { motion, AnimatePresence } from 'framer-motion';
import { Send, AlertCircle } from 'lucide-react';

interface TestMessageConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  testMessagesUsed: number;
  availableCredits: number;
  profilePhone: string | null;
}

export default function TestMessageConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  testMessagesUsed,
  availableCredits,
  profilePhone
}: TestMessageConfirmModalProps) {
  const isPaidTest = testMessagesUsed >= 10;
  const hasInsufficientCredits = isPaidTest && availableCredits < 1;

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
            <div className="flex items-start gap-4 mb-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                isPaidTest
                  ? 'bg-amber-300/20 text-amber-300'
                  : 'bg-sky-300/20 text-sky-300'
              }`}>
                <Send className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white mb-2">
                  {isPaidTest ? 'Send Paid Test Message' : 'Send Free Test Message'}
                </h3>
                <p className="text-sm text-[#bdbdbd]">
                  {isPaidTest ? (
                    <>
                      You've used all your free test messages today. This test will cost{' '}
                      <span className="text-amber-300 font-semibold">1 credit</span>.
                    </>
                  ) : (
                    <>
                      You have{' '}
                      <span className="text-sky-300 font-semibold">{10 - testMessagesUsed} free tests</span>{' '}
                      remaining today. After that, tests cost 1 credit each.
                    </>
                  )}
                </p>
              </div>
            </div>

            {isPaidTest && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-4">
                <div className="flex items-center gap-2 text-sm text-amber-300">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <p>
                    Available credits: <span className="font-semibold">{availableCredits}</span>
                  </p>
                </div>
              </div>
            )}

            <div className="p-4 bg-white/5 border border-white/10 rounded-lg mb-6">
              <p className="text-sm text-white mb-2">
                <span className="font-semibold">Test message will be sent to:</span>
              </p>
              <p className="text-sm text-sky-300">{profilePhone || 'Your registered phone number'}</p>
            </div>

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
                className="flex-1 px-4 py-3 rounded-xl font-bold bg-gradient-to-r from-sky-300 to-lime-300 text-black hover:shadow-[0_0_20px_rgba(125,211,252,0.6)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPaidTest ? 'Send (1 Credit)' : 'Send Test'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}