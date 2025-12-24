import { motion, AnimatePresence } from 'framer-motion';
import { X, Info, Plus, FileText, Sparkles, Shield, Send, Users, Zap } from 'lucide-react';

interface HowCampaignsWorkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HowCampaignsWorkModal({ isOpen, onClose }: HowCampaignsWorkModalProps) {
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
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div>
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Info className="w-6 h-6 text-sky-300" />
                  How SMS Campaigns Work
                </h3>
                <p className="text-sm text-[#bdbdbd] mt-1">
                  Follow these steps to create and launch your automated SMS campaign
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
              <div className="space-y-6">
                {/* Step 1 */}
                <div className="p-5 bg-gradient-to-br from-sky-500/10 to-sky-500/5 border border-sky-500/20 rounded-xl">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-sky-300/20 rounded-full flex items-center justify-center">
                      <span className="text-sky-300 font-bold">1</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                        Create Your Campaign
                        <button className="flex items-center gap-2 px-3 py-1.5 bg-sky-300 text-black rounded-full font-semibold text-xs pointer-events-none opacity-80">
                          <Plus className="w-3 h-3" />
                          Create Message
                        </button>
                      </h4>
                      <p className="text-sm text-[#bdbdbd]">
                        Start by creating a new campaign. You can schedule up to 3 campaigns at once to keep your clients engaged throughout the week or month.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="p-5 bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 rounded-xl">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-amber-300/20 rounded-full flex items-center justify-center">
                      <span className="text-amber-300 font-bold">2</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                        Save as Draft
                        <button className="flex items-center gap-2 px-3 py-1.5 bg-amber-300/20 text-amber-300 border border-amber-300/30 rounded-xl font-semibold text-xs pointer-events-none">
                          <FileText className="w-3 h-3" />
                          Save Draft
                        </button>
                      </h4>
                      <p className="text-sm text-[#bdbdbd] mb-3">
                        Save your message as a draft once it's between 100-240 characters. This preserves your work as unsaved messages disappear when you leave the page.
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#bdbdbd]">You'll see:</span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-300/10 text-amber-300 border border-amber-300/20">
                          Draft
                        </span>
                        <span className="text-xs text-[#bdbdbd]">→</span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-lime-300/10 text-lime-300 border border-lime-300/20">
                          Saved
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="p-5 bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 rounded-xl">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-purple-300/20 rounded-full flex items-center justify-center">
                      <span className="text-purple-300 font-bold">3</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                        Generate AI Template (Optional)
                        <button className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 text-purple-300 rounded-xl font-semibold text-xs pointer-events-none">
                          <Sparkles className="w-3 h-3" />
                          Generate
                        </button>
                      </h4>
                      <p className="text-sm text-[#bdbdbd]">
                        Let AI create a professional message template for you. Use it as a starting point or keep it as-is if it perfectly fits your needs.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="p-5 bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 rounded-xl">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-blue-300/20 rounded-full flex items-center justify-center">
                      <span className="text-blue-300 font-bold">4</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                        Verify Message Compliance
                        <button className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 text-white rounded-xl font-semibold text-xs pointer-events-none">
                          <Shield className="w-3 h-3" />
                          Validate
                        </button>
                      </h4>
                      <p className="text-sm text-[#bdbdbd] mb-3">
                        Ensures your message meets SMS marketing guidelines. Note: Emojis are prohibited as they double the cost per message.
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#bdbdbd]">Status changes to:</span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-300/10 text-sky-300 border border-sky-300/20">
                          Verified
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="p-5 bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/20 rounded-xl">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-cyan-300/20 rounded-full flex items-center justify-center">
                      <span className="text-cyan-300 font-bold">5</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                        Test Your Message
                        <button className="flex items-center gap-2 px-3 py-1.5 bg-sky-300/20 border border-sky-300/30 text-sky-300 rounded-xl font-semibold text-xs pointer-events-none">
                          <Send className="w-3 h-3" />
                          Test
                        </button>
                      </h4>
                      <p className="text-sm text-[#bdbdbd]">
                        <span className="font-semibold text-cyan-300">Crucial step!</span> Preview exactly how your message will appear to clients. You get 10 free tests daily and after that, each test costs 1 credit. Don't worry, you'll be notified before any charges.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Step 6 */}
                <div className="p-5 bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 border border-indigo-500/20 rounded-xl">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-indigo-300/20 rounded-full flex items-center justify-center">
                      <span className="text-indigo-300 font-bold">6</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                        Preview Recipients
                        <button className="flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/5 text-[#bdbdbd] border border-white/10 pointer-events-none">
                          <Users className="w-3 h-3" />
                          Who will receive this message?
                        </button>
                      </h4>
                      <p className="text-sm text-[#bdbdbd]">
                        View the projected recipient list based on our smart targeting algorithm. This list updates daily to always give you the optimal audience. The final confirmed list is provided after all messages are sent.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Step 7 */}
                <div className="p-5 bg-gradient-to-br from-lime-500/10 to-lime-500/5 border border-lime-500/20 rounded-xl">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-lime-300/20 rounded-full flex items-center justify-center">
                      <span className="text-lime-300 font-bold">7</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                        Activate Campaign
                        <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl font-semibold text-xs bg-gradient-to-r from-sky-300 to-lime-300 text-black pointer-events-none">
                          <Zap className="w-3 h-3" />
                          Activate
                        </button>
                      </h4>
                      <p className="text-sm text-[#bdbdbd] mb-3">
                        <span className="font-semibold text-lime-300">Final step!</span> Activate to schedule your message for sending at your chosen time. Messages are ONLY sent when you see the "Active" status.
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#bdbdbd]">Active status:</span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-lime-300/20 text-lime-300 border border-lime-300/30">
                          Active - Click to toggle
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-[#bdbdbd]">Inactive status:</span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-500/10 text-gray-400 border border-gray-500/20">
                          Inactive
                        </span>
                        <span className="text-xs text-rose-300">← No messages will be sent</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Important Note */}
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-amber-300 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-amber-300 mb-1">Important Reminders</h4>
                      <ul className="space-y-1 text-sm text-amber-200/80">
                        <li className="flex gap-2">
                          <span>•</span>
                          <span>Always test your message before activating to see exactly what clients receive</span>
                        </li>
                        <li className="flex gap-2">
                          <span>•</span>
                          <span>Double-check the "Active" status before your scheduled time</span>
                        </li>
                        <li className="flex gap-2">
                          <span>•</span>
                          <span>Credits are reserved when you activate and refunded if you deactivate</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-white/10 px-6 py-4 bg-white/5">
              <button
                onClick={onClose}
                className="w-full px-6 py-3 rounded-xl font-bold bg-gradient-to-r from-sky-300 to-lime-300 text-black hover:shadow-[0_0_20px_rgba(125,211,252,0.6)] transition-all"
              >
                Got it! Let's create a campaign
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}