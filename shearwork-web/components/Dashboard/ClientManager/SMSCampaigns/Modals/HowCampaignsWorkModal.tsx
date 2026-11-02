import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Info, Plus, FileText, Sparkles, Shield, Send, Users, Zap, Phone, AlertCircle } from 'lucide-react';

interface HowCampaignsWorkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Non-interactive sample of a control, shown inline next to a step title. */
const sampleChip = 'inline-flex items-center gap-1.5 h-6 px-2 rounded-md text-[11px] font-semibold pointer-events-none select-none';

function Step({ marker, title, chip, children }: { marker: ReactNode; title: ReactNode; chip?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-raised border border-white/[0.07] rounded-lg">
      <div className="flex-shrink-0 w-7 h-7 rounded-md bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-[13px] font-semibold text-sage tabular-nums">
        {marker}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-ivory text-sm mb-1.5 flex items-center gap-2 flex-wrap">
          {title}
          {chip}
        </h4>
        {children}
      </div>
    </div>
  );
}

export default function HowCampaignsWorkModal({ isOpen, onClose }: HowCampaignsWorkModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="modal-backdrop z-[70] flex items-center justify-center p-2 sm:p-4 min-h-screen"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="modal-surface w-full max-w-3xl max-h-[75vh] sm:max-h-[90vh] flex flex-col overflow-hidden mb-16 sm:mb-0"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-white/[0.07]">
              <div className="flex-1 min-w-0">
                <h3 className="text-[15px] font-semibold text-ivory flex items-center gap-2">
                  <Info className="w-[18px] h-[18px] text-gray-500 flex-shrink-0" strokeWidth={1.75} />
                  <span className="truncate">How SMS Campaigns Work</span>
                </h3>
                <p className="text-[13px] text-muted mt-0.5 hidden sm:block">
                  Follow these steps to create and launch your automated SMS campaign
                </p>
              </div>
              <button onClick={onClose} className="btn btn-ghost btn-sm !h-8 !px-2 flex-shrink-0" aria-label="Close">
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto flex-1 p-3 sm:p-5">
              <div className="space-y-2.5 sm:space-y-3">
                <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-[#D8C59A]/[0.06] border border-[#D8C59A]/20 rounded-lg">
                  <div className="flex-shrink-0 w-7 h-7 rounded-md bg-[#D8C59A]/[0.12] flex items-center justify-center">
                    <Phone className="w-4 h-4 text-[#D8C59A]" strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-ivory mb-1.5 text-sm">
                      Register Your Phone Number
                    </h4>
                    <p className="text-[13px] text-muted">
                      Before you can use schedule your Campaigns, you need to register your phone number. Click your profile icon in the top right corner, select <span className="text-ivory font-semibold">Settings</span>, and update your phone number in the Profile tab. This is required to receive test messages.
                    </p>
                  </div>
                </div>

                {/* Step 1 */}
                <Step
                  marker="1"
                  title={<span>Create Your Campaign</span>}
                  chip={
                    <span className={`${sampleChip} bg-ivory text-ink`}>
                      <Plus className="w-3 h-3" strokeWidth={2} />
                      <span className="hidden xs:inline">Create Message</span>
                      <span className="xs:hidden">Create</span>
                    </span>
                  }
                >
                  <p className="text-[13px] text-muted">
                    Start by creating a new campaign. You can schedule up to 3 campaigns at once to keep your clients engaged throughout the week or month.
                  </p>
                </Step>

                {/* Step 2 */}
                <Step
                  marker="2"
                  title={<span>Save as Draft</span>}
                  chip={
                    <span className={`${sampleChip} text-ivory shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]`}>
                      <FileText className="w-3 h-3" strokeWidth={1.75} />
                      <span className="hidden xs:inline">Save Draft</span>
                      <span className="xs:hidden">Draft</span>
                    </span>
                  }
                >
                  <p className="text-[13px] text-muted mb-2">
                    Save your message as a draft once it's between 100-240 characters. This preserves your work as unsaved messages disappear when you leave the page.
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-500">You'll see:</span>
                    <span className="badge badge-warn">Draft</span>
                    <span className="text-xs text-gray-500">→</span>
                    <span className="badge badge-sage">Saved</span>
                  </div>
                </Step>

                {/* Step 3 */}
                <Step
                  marker="3"
                  title={
                    <>
                      <span className="hidden sm:inline">Generate AI Template (Optional)</span>
                      <span className="sm:hidden">AI Template (Optional)</span>
                    </>
                  }
                  chip={
                    <span className={`${sampleChip} text-ivory shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]`}>
                      <Sparkles className="w-3 h-3" strokeWidth={1.75} />
                      <span className="hidden xs:inline">Generate</span>
                      <span className="xs:hidden">Gen</span>
                    </span>
                  }
                >
                  <p className="text-[13px] text-muted">
                    Let AI create a professional message template for you. Use it as a starting point or keep it as-is if it perfectly fits your needs.
                  </p>
                </Step>

                {/* Step 4 */}
                <Step
                  marker="4"
                  title={
                    <>
                      <span className="hidden sm:inline">Verify Message Compliance</span>
                      <span className="sm:hidden">Verify Compliance</span>
                    </>
                  }
                  chip={
                    <span className={`${sampleChip} text-ivory shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]`}>
                      <Shield className="w-3 h-3" strokeWidth={1.75} />
                      <span className="hidden xs:inline">Validate</span>
                      <span className="xs:hidden">Val</span>
                    </span>
                  }
                >
                  <p className="text-[13px] text-muted mb-2">
                    Ensures your message meets SMS marketing guidelines. Note: Emojis are prohibited as they double the cost per message.
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-500">Status changes to:</span>
                    <span className="badge badge-info">Verified</span>
                  </div>
                </Step>

                {/* Step 5 */}
                <Step
                  marker="5"
                  title={<span>Test Your Message</span>}
                  chip={
                    <span className={`${sampleChip} text-ivory shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]`}>
                      <Send className="w-3 h-3" strokeWidth={1.75} />
                      Test
                    </span>
                  }
                >
                  <p className="text-[13px] text-muted">
                    <span className="font-semibold text-ivory">Crucial step!</span> Preview exactly how your message will appear to clients. Test messages cost 1 credit each once your free tests are used up.
                  </p>
                </Step>

                {/* Step 6 */}
                <Step
                  marker="6"
                  title={
                    <>
                      <span className="hidden sm:inline">Preview Recipients</span>
                      <span className="sm:hidden">Recipients</span>
                    </>
                  }
                  chip={
                    <span className={`${sampleChip} text-muted bg-white/[0.04] border border-white/[0.07]`}>
                      <Users className="w-3 h-3" strokeWidth={1.75} />
                      <span className="hidden sm:inline">Who will receive this message?</span>
                      <span className="sm:hidden">Who?</span>
                    </span>
                  }
                >
                  <p className="text-[13px] text-muted">
                    View the projected recipient list based on our smart targeting algorithm. This list updates daily to always give you the optimal audience. The final confirmed list is provided after all messages are sent.
                  </p>
                </Step>

                {/* Step 7 */}
                <Step
                  marker="7"
                  title={<span>Activate Campaign</span>}
                  chip={
                    <span className={`${sampleChip} bg-sage text-ink`}>
                      <Zap className="w-3 h-3" strokeWidth={2} />
                      <span className="hidden xs:inline">Activate</span>
                      <span className="xs:hidden">Activate</span>
                    </span>
                  }
                >
                  <p className="text-[13px] text-muted mb-2">
                    <span className="font-semibold text-sage-bright">Final step!</span> Activate to schedule your message for sending at your chosen time. Messages are ONLY sent when you see the "Active" status.
                  </p>
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="text-xs text-gray-500">Active status:</span>
                    <span className="badge badge-sage">
                      <span className="hidden sm:inline">Active - Click to toggle</span>
                      <span className="sm:hidden">Active</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-500">Inactive status:</span>
                    <span className="badge">Inactive</span>
                    <span className="text-xs text-[#D99A8B]">← No messages will be sent</span>
                  </div>
                </Step>

                {/* One-time sms recipient */}
                <Step
                  marker={<Users className="w-3.5 h-3.5" strokeWidth={1.75} />}
                  title={<span>One-time Recipients</span>}
                  chip={
                    <span className={`${sampleChip} text-ivory shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]`}>
                      <span className="hidden xs:inline">Add One-time sms recipient</span>
                      <span className="xs:hidden">Add One-time sms recipient</span>
                    </span>
                  }
                >
                  <p className="text-[13px] text-muted mb-2">
                    Add clients who should receive this specific message, regardless of the algorithm. These recipients count toward your max clients limit.
                  </p>
                  <div className="p-2.5 bg-[#D8C59A]/[0.06] border border-[#D8C59A]/20 rounded-md mb-2">
                    <div className="flex items-start gap-2 text-xs text-[#D8C59A]">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                      <p>
                        <span className="font-semibold">Important:</span> Your max clients setting determines how many people you're willing to message. If max is set to 0, you won't be able to see one-time recipients in your client list.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-500">Example:</span>
                      <span className="text-xs text-ivory">Max = 50 → See up to 50 total clients (algorithm + one-time)</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-500">Example:</span>
                      <span className="text-xs text-[#D99A8B]">Max = 0 → No clients visible, no messages sent</span>
                    </div>
                  </div>
                </Step>

                {/* Important Note */}
                <div className="p-3 sm:p-4 bg-white/[0.03] border border-white/[0.07] rounded-lg">
                  <div className="flex items-start gap-3">
                    <Info className="w-4 h-4 text-[#D8C59A] flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-ivory mb-1.5 text-sm">Important Reminders</h4>
                      <ul className="space-y-1 text-[13px] text-muted list-disc pl-4 marker:text-gray-500">
                        <li>Always test your message before activating to see exactly what clients receive</li>
                        <li>Double-check the "Active" status before your scheduled time</li>
                        <li>Credits are reserved when you activate and refunded if you deactivate</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end border-t border-white/[0.07] px-4 sm:px-5 py-3">
              <button onClick={onClose} className="btn btn-primary btn-sm">
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
