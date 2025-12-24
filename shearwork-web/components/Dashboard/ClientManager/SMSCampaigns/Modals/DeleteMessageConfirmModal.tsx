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
              <div className="w-12 h-12 rounded-full bg-rose-300/20 text-rose-300 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white mb-2">
                  Delete Message?
                </h3>
                <p className="text-sm text-[#bdbdbd]">
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
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg mb-4">
                <div className="flex items-start gap-2 text-sm text-rose-300">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p>
                    <span className="font-semibold">This action cannot be undone.</span> All message data will be permanently removed.
                  </p>
                </div>
              </div>
            )}

            {deleteType === 'soft' && (
              <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg mb-4">
                <div className="flex items-start gap-2 text-sm text-purple-300">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p>
                    You can view this campaign's details and recipients in Campaign History at any time.
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 rounded-xl font-bold bg-white/5 text-[#bdbdbd] hover:bg-white/10 hover:text-white transition-all duration-300 border border-white/10"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 px-4 py-3 rounded-xl font-bold bg-rose-300/20 text-rose-300 border border-rose-300/30 hover:bg-rose-300/30 transition-all duration-300"
              >
                {deleteType === 'soft' ? 'Remove from Active' : 'Delete Permanently'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}