import { motion, AnimatePresence } from 'framer-motion';
import { X, Info, Plus, FileText, Sparkles, Shield, Send, Users, Zap, Phone, AlertCircle } from 'lucide-react';

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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-2 sm:p-4 min-h-screen"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#1a1a1a] border border-white/10 rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-4xl max-h-[75vh] sm:max-h-[90vh] flex flex-col overflow-hidden mb-16 sm:mb-0"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between p-3 sm:p-6 border-b border-white/10">
              <div className="flex-1 min-w-0 pr-2">
                <h3 className="text-base sm:text-2xl font-bold text-white flex items-center gap-1.5 sm:gap-2">
                  <Info className="w-4 h-4 sm:w-6 sm:h-6 text-sky-300 flex-shrink-0" />
                  <span className="truncate">How SMS Campaigns Work</span>
                </h3>
                <p className="text-xs sm:text-sm text-[#bdbdbd] mt-1 hidden sm:block">
                  Follow these steps to create and launch your automated SMS campaign
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 sm:p-2 hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5 text-[#bdbdbd]" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto flex-1 p-3 sm:p-6">
              <div className="space-y-3 sm:space-y-6">
                <div className="p-3 sm:p-5 bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 rounded-xl">
                  <div className="flex items-start gap-2 sm:gap-4">
                    <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 bg-amber-300/20 rounded-full flex items-center justify-center">
                      <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-white mb-2 text-sm sm:text-base">
                        Register Your Phone Number
                      </h4>
                      <p className="text-xs sm:text-sm text-[#bdbdbd]">
                        Before you can use schedule your Campaigns, you need to register your phone number. Click your profile icon in the top right corner, select <span className="text-white font-semibold">Settings</span>, and update your phone number in the Profile tab. This is required to receive test messages.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Step 1 */}
                <div className="p-3 sm:p-5 bg-gradient-to-br from-sky-500/10 to-sky-500/5 border border-sky-500/20 rounded-lg sm:rounded-xl">
                  <div className="flex items-start gap-2 sm:gap-4">
                    <div className="flex-shrink-0 w-7 h-7 sm:w-10 sm:h-10 bg-sky-300/20 rounded-full flex items-center justify-center">
                      <span className="text-sky-300 font-bold text-sm sm:text-base">1</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-white text-sm sm:text-base mb-1.5 sm:mb-2 flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span>Create Your Campaign</span>
                        <button className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-sky-300 text-black rounded-full font-semibold text-[10px] sm:text-xs pointer-events-none opacity-80">
                          <Plus className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          <span className="hidden xs:inline">Create Message</span>
                          <span className="xs:hidden">Create</span>
                        </button>
                      </h4>
                      <p className="text-xs sm:text-sm text-[#bdbdbd]">
                        Start by creating a new campaign. You can schedule up to 3 campaigns at once to keep your clients engaged throughout the week or month.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="p-3 sm:p-5 bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 rounded-lg sm:rounded-xl">
                  <div className="flex items-start gap-2 sm:gap-4">
                    <div className="flex-shrink-0 w-7 h-7 sm:w-10 sm:h-10 bg-amber-300/20 rounded-full flex items-center justify-center">
                      <span className="text-amber-300 font-bold text-sm sm:text-base">2</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-white text-sm sm:text-base mb-1.5 sm:mb-2 flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span>Save as Draft</span>
                        <button className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-amber-300/20 text-amber-300 border border-amber-300/30 rounded-lg sm:rounded-xl font-semibold text-[10px] sm:text-xs pointer-events-none">
                          <FileText className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          <span className="hidden xs:inline">Save Draft</span>
                          <span className="xs:hidden">Draft</span>
                        </button>
                      </h4>
                      <p className="text-xs sm:text-sm text-[#bdbdbd] mb-2 sm:mb-3">
                        Save your message as a draft once it's between 100-240 characters. This preserves your work as unsaved messages disappear when you leave the page.
                      </p>
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="text-[10px] sm:text-xs text-[#bdbdbd]">You'll see:</span>
                        <span className="px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-amber-300/10 text-amber-300 border border-amber-300/20">
                          Draft
                        </span>
                        <span className="text-[10px] sm:text-xs text-[#bdbdbd]">→</span>
                        <span className="px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-lime-300/10 text-lime-300 border border-lime-300/20">
                          Saved
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="p-3 sm:p-5 bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 rounded-lg sm:rounded-xl">
                  <div className="flex items-start gap-2 sm:gap-4">
                    <div className="flex-shrink-0 w-7 h-7 sm:w-10 sm:h-10 bg-purple-300/20 rounded-full flex items-center justify-center">
                      <span className="text-purple-300 font-bold text-sm sm:text-base">3</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-white text-sm sm:text-base mb-1.5 sm:mb-2 flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="hidden sm:inline">Generate AI Template (Optional)</span>
                        <span className="sm:hidden">AI Template (Optional)</span>
                        <button className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-purple-500/20 border border-purple-500/30 text-purple-300 rounded-lg sm:rounded-xl font-semibold text-[10px] sm:text-xs pointer-events-none">
                          <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          <span className="hidden xs:inline">Generate</span>
                          <span className="xs:hidden">Gen</span>
                        </button>
                      </h4>
                      <p className="text-xs sm:text-sm text-[#bdbdbd]">
                        Let AI create a professional message template for you. Use it as a starting point or keep it as-is if it perfectly fits your needs.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="p-3 sm:p-5 bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 rounded-lg sm:rounded-xl">
                  <div className="flex items-start gap-2 sm:gap-4">
                    <div className="flex-shrink-0 w-7 h-7 sm:w-10 sm:h-10 bg-blue-300/20 rounded-full flex items-center justify-center">
                      <span className="text-blue-300 font-bold text-sm sm:text-base">4</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-white text-sm sm:text-base mb-1.5 sm:mb-2 flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="hidden sm:inline">Verify Message Compliance</span>
                        <span className="sm:hidden">Verify Compliance</span>
                        <button className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-white/5 border border-white/10 text-white rounded-lg sm:rounded-xl font-semibold text-[10px] sm:text-xs pointer-events-none">
                          <Shield className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          <span className="hidden xs:inline">Validate</span>
                          <span className="xs:hidden">Val</span>
                        </button>
                      </h4>
                      <p className="text-xs sm:text-sm text-[#bdbdbd] mb-2 sm:mb-3">
                        Ensures your message meets SMS marketing guidelines. Note: Emojis are prohibited as they double the cost per message.
                      </p>
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="text-[10px] sm:text-xs text-[#bdbdbd]">Status changes to:</span>
                        <span className="px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-sky-300/10 text-sky-300 border border-sky-300/20">
                          Verified
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="p-3 sm:p-5 bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/20 rounded-lg sm:rounded-xl">
                  <div className="flex items-start gap-2 sm:gap-4">
                    <div className="flex-shrink-0 w-7 h-7 sm:w-10 sm:h-10 bg-cyan-300/20 rounded-full flex items-center justify-center">
                      <span className="text-cyan-300 font-bold text-sm sm:text-base">5</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-white text-sm sm:text-base mb-1.5 sm:mb-2 flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span>Test Your Message</span>
                        <button className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-sky-300/20 border border-sky-300/30 text-sky-300 rounded-lg sm:rounded-xl font-semibold text-[10px] sm:text-xs pointer-events-none">
                          <Send className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          Test
                        </button>
                      </h4>
                      <p className="text-xs sm:text-sm text-[#bdbdbd]">
                        <span className="font-semibold text-cyan-300">Crucial step!</span> Preview exactly how your message will appear to clients. You get 10 free tests daily and after that, each test costs 1 credit. Don't worry, you'll be notified before any charges.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Step 6 */}
                <div className="p-3 sm:p-5 bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 border border-indigo-500/20 rounded-lg sm:rounded-xl">
                  <div className="flex items-start gap-2 sm:gap-4">
                    <div className="flex-shrink-0 w-7 h-7 sm:w-10 sm:h-10 bg-indigo-300/20 rounded-full flex items-center justify-center">
                      <span className="text-indigo-300 font-bold text-sm sm:text-base">6</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-white text-sm sm:text-base mb-1.5 sm:mb-2 flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="hidden sm:inline">Preview Recipients</span>
                        <span className="sm:hidden">Recipients</span>
                        <button className="flex items-center gap-1 sm:gap-2 px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-white/5 text-[#bdbdbd] border border-white/10 pointer-events-none">
                          <Users className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          <span className="hidden sm:inline">Who will receive this message?</span>
                          <span className="sm:hidden">Who?</span>
                        </button>
                      </h4>
                      <p className="text-xs sm:text-sm text-[#bdbdbd]">
                        View the projected recipient list based on our smart targeting algorithm. This list updates daily to always give you the optimal audience. The final confirmed list is provided after all messages are sent.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Step 7 */}
                <div className="p-3 sm:p-5 bg-gradient-to-br from-lime-500/10 to-lime-500/5 border border-lime-500/20 rounded-lg sm:rounded-xl">
                  <div className="flex items-start gap-2 sm:gap-4">
                    <div className="flex-shrink-0 w-7 h-7 sm:w-10 sm:h-10 bg-lime-300/20 rounded-full flex items-center justify-center">
                      <span className="text-lime-300 font-bold text-sm sm:text-base">7</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-white text-sm sm:text-base mb-1.5 sm:mb-2 flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span>Activate Campaign</span>
                        <button className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl font-semibold text-[10px] sm:text-xs bg-gradient-to-r from-sky-300 to-lime-300 text-black pointer-events-none">
                          <Zap className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          <span className="hidden xs:inline">Activate</span>
                          <span className="xs:hidden">Activate</span>
                        </button>
                      </h4>
                      <p className="text-xs sm:text-sm text-[#bdbdbd] mb-2 sm:mb-3">
                        <span className="font-semibold text-lime-300">Final step!</span> Activate to schedule your message for sending at your chosen time. Messages are ONLY sent when you see the "Active" status.
                      </p>
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mb-1.5 sm:mb-2">
                        <span className="text-[10px] sm:text-xs text-[#bdbdbd]">Active status:</span>
                        <span className="px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-lime-300/20 text-lime-300 border border-lime-300/30 whitespace-nowrap">
                          <span className="hidden sm:inline">Active - Click to toggle</span>
                          <span className="sm:hidden">Active</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="text-[10px] sm:text-xs text-[#bdbdbd]">Inactive status:</span>
                        <span className="px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-gray-500/10 text-gray-400 border border-gray-500/20">
                          Inactive
                        </span>
                        <span className="text-[10px] sm:text-xs text-rose-300">← No messages will be sent</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* One-time sms recipient */}
                <div className="p-3 sm:p-5 bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 rounded-lg sm:rounded-xl">
                  <div className="flex items-start gap-2 sm:gap-4">
                    <div className="flex-shrink-0 w-7 h-7 sm:w-10 sm:h-10 bg-purple-300/20 rounded-full flex items-center justify-center">
                      <Users className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-purple-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-white text-sm sm:text-base mb-1.5 sm:mb-2 flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span>One-time Recipients</span>
                        <button className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl font-semibold text-[10px] sm:text-xs bg-lime-300/20 text-lime-300 border border-lime-300/30 pointer-events-none">
                          <span className="hidden xs:inline">Add One-time sms recipient</span>
                          <span className="xs:hidden">Add One-time sms recipient</span>
                        </button>
                      </h4>
                      <p className="text-xs sm:text-sm text-[#bdbdbd] mb-2 sm:mb-3">
                        Add clients who should receive this specific message, regardless of the algorithm. These recipients count toward your max clients limit.
                      </p>
                      <div className="p-2 sm:p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-2 sm:mb-3">
                        <div className="flex items-start gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-amber-300">
                          <AlertCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0 mt-0.5" />
                          <p>
                            <span className="font-semibold">Important:</span> Your max clients setting determines how many people you're willing to message. If max is set to 0, you won't be able to see one-time recipients in your client list.
                          </p>
                        </div>
                      </div>
                      <div className="space-y-1.5 sm:space-y-2">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <span className="text-[10px] sm:text-xs text-[#bdbdbd]">Example:</span>
                          <span className="text-[10px] sm:text-xs text-white">Max = 50 → See up to 50 total clients (algorithm + one-time)</span>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <span className="text-[10px] sm:text-xs text-[#bdbdbd]">Example:</span>
                          <span className="text-[10px] sm:text-xs text-rose-300">Max = 0 → No clients visible, no messages sent</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Important Note */}
                <div className="p-3 sm:p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg sm:rounded-xl">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <Info className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-amber-300 mb-1 text-sm sm:text-base">Important Reminders</h4>
                      <ul className="space-y-1 text-xs sm:text-sm text-amber-200/80">
                        <li className="flex gap-2">
                          <span className="flex-shrink-0">•</span>
                          <span>Always test your message before activating to see exactly what clients receive</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="flex-shrink-0">•</span>
                          <span>Double-check the "Active" status before your scheduled time</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="flex-shrink-0">•</span>
                          <span>Credits are reserved when you activate and refunded if you deactivate</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-white/10 px-3 sm:px-6 py-3 sm:py-4 bg-white/5">
              <button
                onClick={onClose}
                className="w-full px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-sm sm:text-base font-bold bg-gradient-to-r from-sky-300 to-lime-300 text-black hover:shadow-[0_0_20px_rgba(125,211,252,0.6)] transition-all"
              >
                <span className="hidden sm:inline">Got it! Let's create a campaign</span>
                <span className="sm:hidden">Got it!</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}