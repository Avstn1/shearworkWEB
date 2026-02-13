'use client'

import { Loader2 } from 'lucide-react'

interface AutoNudgeStepProps {
  onBack: () => void
  onFinish: () => void
  profileLoading: boolean
}

export default function AutoNudgeActivationStep({
  onBack,
  onFinish,
  profileLoading,
}: AutoNudgeStepProps) {
  return (
    <div className="space-y-6 animate-fadeInUp">
      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.4s ease-out forwards;
        }
      `}</style>

      <div className="space-y-6 rounded-2xl border border-white/10 bg-black/20 p-6">
        <h3 className="text-sm font-semibold text-white uppercase tracking-[0.2em]">Auto Nudge Activation</h3>
        
        <div className="py-12 text-center">
          <p className="text-gray-400">Auto nudge configuration coming soon...</p>
        </div>

        {/* Back and Finish Buttons */}
        <div className="flex justify-between items-center gap-4 pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-3 font-semibold rounded-xl bg-white/10 border border-white/20 hover:bg-white/15 transition-all"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onFinish}
            disabled={profileLoading}
            className={`px-8 py-3 font-semibold rounded-xl transition-all ${
              profileLoading
                ? 'bg-white/5 border border-white/10 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-[#7affc9] to-[#3af1f7] text-black hover:shadow-lg'
            }`}
          >
            {profileLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Finishing...
              </span>
            ) : (
              'Finish onboarding'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}