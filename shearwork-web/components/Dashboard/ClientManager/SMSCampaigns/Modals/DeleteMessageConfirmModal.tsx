import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Info } from 'lucide-react';

interface DeleteMessageConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  deleteType: 'soft' | 'hard';
}

export default function DeleteMessageConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  deleteType
}: DeleteMessageConfirmModalProps) {
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
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-rose-300/20 text-rose-300 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg md:text-xl font-bold text-white mb-2">
                  Delete Message?
                </h3>
                <p className="text-xs md:text-sm text-[#bdbdbd]">
                  {deleteType === 'soft' ? (
                    <>
                      This completed campaign will be removed from your active messages but will still be visible in{' '}
                      <span className="text-purple-300 font-semibold">Campaign History</span> for your records.
                    </>
                  ) : (
                    <>
                      This message will be <span className="text-rose-300 font-semibold">permanently deleted</span>.
                      You won't be able to see it again or recover any information about it.
                    </>
                  )}
                </p>
              </div>
            </div>

            {deleteType === 'hard' && (
              <div className="p-2.5 md:p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg mb-4">
                <div className="flex items-start gap-2 text-xs md:text-sm text-rose-300">
                  <AlertCircle className="w-3.5 h-3.5 md:w-4 md:h-4 flex-shrink-0 mt-0.5" />
                  <p>
                    <span className="font-semibold">This action cannot be undone.</span> All message data will be permanently removed.
                  </p>
                </div>
              </div>
            )}

            {deleteType === 'soft' && (
              <div className="p-2.5 md:p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg mb-4">
                <div className="flex items-start gap-2 text-xs md:text-sm text-purple-300">
                  <Info className="w-3.5 h-3.5 md:w-4 md:h-4 flex-shrink-0 mt-0.5" />
                  <p>
                    You can view this campaign's details and recipients in Campaign History at any time.
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-2 md:gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-3 md:px-4 py-2.5 md:py-3 rounded-xl text-sm md:text-base font-bold bg-white/5 text-[#bdbdbd] hover:bg-white/10 hover:text-white transition-all duration-300 border border-white/10"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 px-3 md:px-4 py-2.5 md:py-3 rounded-xl text-sm md:text-base font-bold bg-rose-300/20 text-rose-300 border border-rose-300/30 hover:bg-rose-300/30 transition-all duration-300"
              >
                <span className="hidden sm:inline">{deleteType === 'soft' ? 'Remove from Active' : 'Delete Permanently'}</span>
                <span className="sm:hidden">{deleteType === 'soft' ? 'Remove' : 'Delete'}</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}