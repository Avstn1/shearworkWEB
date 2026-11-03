import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, Clock, Zap, AlertCircle, ChevronRight } from 'lucide-react';

interface HowAutoNudgeWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TimelineDot = ({ color }: { color: string }) => (
  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5 ring-4 ring-surface ${color}`} />
);

export default function HowAutoNudgeWorksModal({ isOpen, onClose }: HowAutoNudgeWorksModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="modal-backdrop !z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="modal-surface !rounded-b-none sm:!rounded-[0.875rem] w-full max-w-2xl flex flex-col overflow-hidden max-h-[85vh] sm:max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/[0.07] flex-shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <Zap className="w-[18px] h-[18px] text-sage flex-shrink-0" strokeWidth={1.75} />
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold text-ivory leading-tight">How Auto Nudge works</h3>
                  <p className="text-xs text-muted mt-0.5 hidden sm:block">Automated weekly SMS, controlled entirely by you</p>
                </div>
              </div>
              <button onClick={onClose} className="btn btn-ghost btn-sm !h-8 !px-2 flex-shrink-0" aria-label="Close">
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">

              <p className="text-sm text-muted leading-relaxed">
                Auto Nudge sends a weekly SMS to your clients to bring them back in. You stay in control: every week, you approve the message before it goes out.
              </p>

              <div>
                <p className="stat-label mb-3">Every week</p>
                <div className="relative">
                  <div className="absolute left-[4px] top-4 bottom-4 w-px bg-white/[0.07]" />
                  <div className="space-y-0">
                    <div className="flex gap-4 pb-5">
                      <TimelineDot color="bg-[#9CCBFF]" />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-[13px] font-semibold text-ivory">Monday · 10 AM</span>
                          <span className="badge badge-info">Authorization</span>
                        </div>
                        <p className="text-sm text-gray-300 leading-relaxed">
                          You get a text from Corva asking if you want to send the nudge this week.{' '}
                          <span className="text-ivory font-medium">Reply YES</span> to give the green light,{' '}
                          <span className="text-ivory font-medium">reply NO</span> (or ignore it) to skip this week.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-4 pb-5">
                      <TimelineDot color="bg-sage" />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-[13px] font-semibold text-ivory">Monday – Saturday</span>
                          <span className="badge badge-sage">Client SMS sends</span>
                        </div>
                        <p className="text-sm text-gray-300 leading-relaxed">
                          If you said YES, your clients automatically receive booking reminder SMS throughout the week based on their optimal timing. If you didn&apos;t approve, nothing is sent. No action needed.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <TimelineDot color="bg-[#FFC97A]" />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-[13px] font-semibold text-ivory">Sunday · 10 PM</span>
                          <span className="badge badge-warn">Weekly results</span>
                        </div>
                        <p className="text-sm text-gray-300 leading-relaxed">
                          You receive a summary text with how many bookings Corva brought back and the total revenue recovered for the week.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="divider" />

              <div>
                <p className="stat-label mb-3">When you first enable it</p>
                <div className="space-y-2.5">
                  <div className="flex items-start gap-3 p-3.5 rounded-lg bg-white/[0.02] border border-white/[0.07]">
                    <CheckCircle className="w-4 h-4 text-sage flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-sm font-semibold text-ivory">If you onboarded Monday–Wednesday</p>
                        <span className="badge badge-sage">Catch-up week</span>
                      </div>
                      <p className="text-[13px] text-muted leading-relaxed">
                        If you missed Monday&apos;s 10 AM text, no worries. Since Auto Nudge is already enabled, you&apos;ll get your first authorization text <span className="text-ivory">the next day</span>. Say YES and your clients get the SMS shortly after.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3.5 rounded-lg bg-white/[0.02] border border-white/[0.07]">
                    <Clock className="w-4 h-4 text-[#FFC97A] flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-sm font-semibold text-ivory">If you onboarded Thursday–Sunday</p>
                        <span className="badge badge-warn">Starts next week</span>
                      </div>
                      <p className="text-[13px] text-muted leading-relaxed">
                        Too late in the week to send responsibly. Since Auto Nudge is already enabled, your first authorization text will arrive <span className="text-ivory">next Monday at 10 AM</span>, then the normal weekly rhythm kicks in.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="divider" />

              <div>
                <p className="stat-label mb-3">The flow at a glance</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { label: 'Auto Nudge on', color: 'badge' },
                    { icon: <ChevronRight className="w-3 h-3 text-gray-500" strokeWidth={1.75} /> },
                    { label: 'Corva texts you Monday', color: 'badge badge-info' },
                    { icon: <ChevronRight className="w-3 h-3 text-gray-500" strokeWidth={1.75} /> },
                    { label: 'You reply YES', color: 'badge' },
                    { icon: <ChevronRight className="w-3 h-3 text-gray-500" strokeWidth={1.75} /> },
                    { label: 'Clients get SMS all week', color: 'badge badge-sage' },
                    { icon: <ChevronRight className="w-3 h-3 text-gray-500" strokeWidth={1.75} /> },
                    { label: 'Results Sunday 10 PM', color: 'badge badge-warn' },
                  ].map((item, i) =>
                    'icon' in item ? (
                      <span key={i}>{item.icon}</span>
                    ) : (
                      <span key={i} className={`${item.color} !py-1 !px-2 !text-[11px]`}>
                        {item.label}
                      </span>
                    )
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-white/[0.03] border border-white/[0.07]">
                <AlertCircle className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                <p className="text-[13px] text-muted leading-relaxed">
                  If you don&apos;t reply to Monday&apos;s text, that week is simply skipped. Your clients will never receive an unsanctioned message. You&apos;re always in control.
                </p>
              </div>

            </div>

            {/* Footer */}
            <div className="flex justify-end border-t border-white/[0.07] px-5 py-3.5 flex-shrink-0">
              <button onClick={onClose} className="btn btn-primary btn-sm w-full sm:w-auto">
                Got it
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}