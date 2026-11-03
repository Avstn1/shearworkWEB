import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Info, X } from 'lucide-react';

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
                <AlertCircle className="w-[18px] h-[18px] text-[#FF8F7D] flex-shrink-0" strokeWidth={1.75} />
                <h3 className="text-[15px] font-semibold text-ivory">Delete message?</h3>
              </div>
              <button onClick={onClose} className="btn btn-ghost btn-sm !h-8 !px-2" aria-label="Close">
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <p className="text-sm text-muted">
                {deleteType === 'soft' ? (
                  <>
                    This completed campaign will be removed from your active messages but will still be visible in{' '}
                    <span className="text-ivory font-semibold">Campaign History</span> for your records.
                  </>
                ) : (
                  <>
                    This message will be <span className="text-[#FF8F7D] font-semibold">permanently deleted</span>.
                    You won't be able to see it again or recover any information about it.
                  </>
                )}
              </p>

              {deleteType === 'hard' && (
                <div className="p-3 bg-[#FF8F7D]/[0.08] border border-[#FF8F7D]/20 rounded-lg">
                  <div className="flex items-start gap-2 text-[13px] text-[#FF8F7D]">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                    <p>
                      <span className="font-semibold">This action cannot be undone.</span> All message data will be permanently removed.
                    </p>
                  </div>
                </div>
              )}

              {deleteType === 'soft' && (
                <div className="p-3 bg-white/[0.03] border border-white/[0.07] rounded-lg">
                  <div className="flex items-start gap-2 text-[13px] text-[#9CCBFF]">
                    <Info className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                    <p>
                      You can view this campaign's details and recipients in Campaign History at any time.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-white/[0.07]">
              <button onClick={onClose} className="btn btn-ghost btn-sm">
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="btn btn-sm bg-[#FF8F7D]/[0.14] text-[#FF8F7D] shadow-[inset_0_0_0_1px_rgba(255,143,125,0.3)] hover:bg-[#FF8F7D]/[0.22]"
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
