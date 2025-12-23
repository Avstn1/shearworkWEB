import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Calendar } from 'lucide-react';

interface CampaignHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CampaignHistoryModal({ isOpen, onClose }: CampaignHistoryModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10 bg-gradient-to-r from-purple-500/10 to-pink-500/10">
              <div>
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Clock className="w-6 h-6 text-purple-300" />
                  Campaign History
                </h3>
                <p className="text-sm text-[#bdbdbd] mt-1">
                  View your past SMS campaigns and their performance
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-[#bdbdbd]" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-200px)] p-6">
              {/* Placeholder content */}
              <div className="space-y-4">
                <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-white">[Campaign Title]</h4>
                    <span className="px-2 py-1 rounded-full text-xs font-semibold bg-lime-300/10 text-lime-300 border border-lime-300/20">
                      Completed
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[#bdbdbd]">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      [Date sent]
                    </span>
                    <span>•</span>
                    <span>[X] recipients</span>
                    <span>•</span>
                    <span>[Success rate]</span>
                  </div>
                </div>

                <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-white">[Campaign Title]</h4>
                    <span className="px-2 py-1 rounded-full text-xs font-semibold bg-lime-300/10 text-lime-300 border border-lime-300/20">
                      Completed
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[#bdbdbd]">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      [Date sent]
                    </span>
                    <span>•</span>
                    <span>[X] recipients</span>
                    <span>•</span>
                    <span>[Success rate]</span>
                  </div>
                </div>

                {/* Empty state placeholder */}
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 text-[#bdbdbd] mx-auto mb-4 opacity-50" />
                  <p className="text-[#bdbdbd]">Campaign history will appear here</p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-white/10 px-6 py-4 bg-white/5">
              <button
                onClick={onClose}
                className="w-full px-6 py-3 rounded-xl font-bold bg-white/10 text-white hover:bg-white/20 transition-all"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}