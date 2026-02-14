'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Zap, ChevronRight, Loader2 } from 'lucide-react'
import { supabase } from '@/utils/supabaseClient'
import { TRIAL_DAYS } from '@/lib/constants/trial'

interface TrialStatusHubProps {
  userId: string
  daysRemaining: number
  onNavigateToAutoNudge: () => void
}

type AutoNudgeStatus = 'loading' | 'not_setup' | 'draft' | 'active'

function getUrgencyColor(daysRemaining: number) {
  if (daysRemaining <= 3) return 'bg-red-500'
  if (daysRemaining <= 7) return 'bg-amber-500'
  return 'bg-lime-300'
}

function getAutoNudgeStatusText(status: AutoNudgeStatus): { text: string; color: string } {
  switch (status) {
    case 'loading':
      return { text: '...', color: 'text-[#9ca3af]' }
    case 'not_setup':
      return { text: 'Not set up', color: 'text-[#9ca3af]' }
    case 'draft':
      return { text: 'Ready', color: 'text-amber-400' }
    case 'active':
      return { text: 'Active', color: 'text-lime-300' }
  }
}

export default function TrialStatusHub({
  userId,
  daysRemaining,
  onNavigateToAutoNudge,
}: TrialStatusHubProps) {
  const [autoNudgeStatus, setAutoNudgeStatus] = useState<AutoNudgeStatus>('loading')

  useEffect(() => {
    const checkAutoNudgeStatus = async () => {
      if (!userId) {
        setAutoNudgeStatus('not_setup')
        return
      }

      try {
        // Check for any auto-nudge messages
        const { data, error } = await supabase
          .from('sms_scheduled_messages')
          .select('id, status, enabled')
          .eq('user_id', userId)
          .eq('purpose', 'auto-nudge')

        if (error) {
          setAutoNudgeStatus('not_setup')
          return
        }

        if (!data || data.length === 0) {
          // No messages created yet
          setAutoNudgeStatus('not_setup')
          return
        }

        // Check if any are active (ACCEPTED + enabled)
        const hasActive = data.some(msg => msg.status === 'ACCEPTED' && msg.enabled === true)
        if (hasActive) {
          setAutoNudgeStatus('active')
          return
        }

        // Check if any are in draft (messages exist but not activated)
        // This means they've set it up but haven't activated (or can't as trial user)
        setAutoNudgeStatus('draft')
      } catch {
        setAutoNudgeStatus('not_setup')
      }
    }

    checkAutoNudgeStatus()
  }, [userId])

  const daysPassed = TRIAL_DAYS - daysRemaining
  const progressPercent = Math.min(100, Math.max(0, (daysPassed / TRIAL_DAYS) * 100))
  const statusInfo = getAutoNudgeStatusText(autoNudgeStatus)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="mb-4"
    >
      {/* Status line */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-[#bdbdbd] mb-2">
        {/* Days remaining */}
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          <span>
            <span className="text-white font-medium">{daysRemaining}</span> days left
          </span>
        </div>
        
        <span className="text-white/30">•</span>
        
        {/* Auto-Nudge status */}
        <div className="flex items-center gap-1.5">
          {autoNudgeStatus === 'loading' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Zap className={`w-3.5 h-3.5 ${autoNudgeStatus === 'active' ? 'text-lime-300' : autoNudgeStatus === 'draft' ? 'text-amber-400' : 'text-[#9ca3af]'}`} />
          )}
          <span>
            Auto-Nudge: <span className={`font-medium ${statusInfo.color}`}>{statusInfo.text}</span>
          </span>
        </div>

        {/* Action based on status */}
        {autoNudgeStatus === 'not_setup' && (
          <button
            onClick={onNavigateToAutoNudge}
            className="inline-flex items-center gap-0.5 text-lime-300 hover:text-lime-200 font-medium transition-colors"
          >
            Set up
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}

        {autoNudgeStatus === 'draft' && (
          <span className="text-amber-400/80 text-[10px]">(upgrade to activate)</span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={`h-full ${getUrgencyColor(daysRemaining)} rounded-full`}
        />
      </div>
    </motion.div>
  )
}
