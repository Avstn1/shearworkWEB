import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquare, Calendar, CheckCircle, Clock, Zap, AlertCircle, ChevronRight } from 'lucide-react';

interface HowAutoNudgeWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TimelineDot = ({ color }: { color: string }) => (
  <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1.5 ring-4 ${color}`} />
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
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#141414] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[85vh] sm:max-h-none sm:mb-0"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0 bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-400/20 to-lime-400/20 border border-white/10 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-4 h-4 text-sky-300" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white leading-none">How Auto Nudge Works</h3>
                  <p className="text-xs text-white/40 mt-0.5 hidden sm:block">Automated weekly SMS, controlled entirely by you</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-white/10 rounded-full transition-colors flex-shrink-0 ml-3"
              >
                <X className="w-4 h-4 text-white/40" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">

              <p className="text-sm text-white/50 leading-relaxed">
                Auto Nudge sends a weekly SMS to your clients to bring them back in. You stay in control: every week, you approve the message before it goes out.
              </p>

              <div>
                <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">Every Week</p>
                <div className="relative">
                  <div className="absolute left-[5px] top-4 bottom-4 w-px bg-white/8" />
                  <div className="space-y-0">
                    <div className="flex gap-4 pb-5">
                      <TimelineDot color="bg-sky-400 ring-sky-400/20" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-sky-300 uppercase tracking-wide">Monday · 10 AM</span>
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-sky-400/10 text-sky-300 border border-sky-400/20">Authorization</span>
                        </div>
                        <p className="text-sm text-white/60 leading-relaxed">
                          You get a text from Corva asking if you want to send the nudge this week.{' '}
                          <span className="text-white font-medium">Reply YES</span> to give the green light,{' '}
                          <span className="text-white font-medium">reply NO</span> (or ignore it) to skip this week.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <TimelineDot color="bg-lime-400 ring-lime-400/20" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-lime-300 uppercase tracking-wide">Wednesday · 10 AM</span>
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-lime-400/10 text-lime-300 border border-lime-400/20">Client SMS Sends</span>
                        </div>
                        <p className="text-sm text-white/60 leading-relaxed">
                          If you said YES on Monday, your clients automatically receive a booking reminder SMS. If you didn't approve, nothing is sent. No action needed.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="h-px bg-white/6" />

              <div>
                <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">When You First Enable It</p>
                <div className="space-y-2.5">
                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-emerald-500/[0.07] border border-emerald-500/15">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-sm font-semibold text-white">If you onboarded Monday–Wednesday</p>
                        <span className="text-[10px] text-emerald-400/80 font-medium">Catch-up week</span>
                      </div>
                      <p className="text-xs text-white/50 leading-relaxed">
                        If you missed Monday's 10 AM text, no worries. Since Auto Nudge is already enabled, you'll get your first authorization text <span className="text-white/80">the next day</span>. Say YES and your clients get the SMS shortly after.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/[0.07] border border-amber-500/15">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-sm font-semibold text-white">If you onboarded Thursday–Sunday</p>
                        <span className="text-[10px] text-amber-400/80 font-medium">Starts next week</span>
                      </div>
                      <p className="text-xs text-white/50 leading-relaxed">
                        Too late in the week to send responsibly. Since Auto Nudge is already enabled, your first authorization text will arrive <span className="text-white/80">next Monday at 10 AM</span>, then the normal weekly rhythm kicks in.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="h-px bg-white/6" />

              <div>
                <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">The Flow at a Glance</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { label: 'Auto Nudge On', color: 'bg-white/8 text-white/70 border-white/10' },
                    { icon: <ChevronRight className="w-3 h-3 text-white/20" /> },
                    { label: 'Corva texts you Monday', color: 'bg-sky-500/10 text-sky-300 border-sky-500/20' },
                    { icon: <ChevronRight className="w-3 h-3 text-white/20" /> },
                    { label: 'You reply YES', color: 'bg-white/8 text-white/70 border-white/10' },
                    { icon: <ChevronRight className="w-3 h-3 text-white/20" /> },
                    { label: 'Clients get SMS Wednesday', color: 'bg-lime-500/10 text-lime-300 border-lime-500/20' },
                  ].map((item, i) =>
                    'icon' in item ? (
                      <span key={i}>{item.icon}</span>
                    ) : (
                      <span key={i} className={`px-2 py-1 rounded-lg text-[11px] font-medium border ${item.color}`}>
                        {item.label}
                      </span>
                    )
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/8">
                <AlertCircle className="w-4 h-4 text-white/30 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-white/40 leading-relaxed">
                  If you don't reply to Monday's text, that week is simply skipped. Your clients will never receive an unsanctioned message. You're always in control.
                </p>
              </div>

            </div>

            {/* Footer */}
            <div className="border-t border-white/8 px-4 sm:px-6 py-3.5 bg-white/[0.02] flex-shrink-0">
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-sky-300 to-lime-300 text-black hover:shadow-[0_0_24px_rgba(125,211,252,0.4)] transition-all active:scale-[0.98]"
              >
                Got it
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}