'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Zap, ChevronRight, Loader2, Clock } from 'lucide-react'
import { supabase } from '@/utils/supabaseClient'
import { TRIAL_DAYS } from '@/lib/constants/trial'

interface TrialStatusHubProps {
  userId: string
  daysRemaining: number
  dateAutoNudgeEnabled: string | null
  onNavigateToAutoNudge: () => void
}

/**
 * Calculate the next nudge date based on when auto-nudge was enabled.
 */
function calculateNextNudgeDate(dateEnabled: string): Date {
  const enabled = new Date(dateEnabled)
  const dayOfWeek = enabled.getDay()
  
  const nextNudge = new Date(enabled)
  nextNudge.setHours(10, 0, 0, 0)
  
  if (dayOfWeek >= 1 && dayOfWeek <= 3) {
    nextNudge.setDate(nextNudge.getDate() + 1)
  } else {
    const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek)
    nextNudge.setDate(nextNudge.getDate() + daysUntilMonday)
  }
  
  return nextNudge
}

function formatNextNudgeDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function getUrgencyColor(daysRemaining: number) {
  if (daysRemaining <= 3) return 'bg-red-500'
  if (daysRemaining <= 7) return 'bg-amber-500'
  return 'bg-lime-300'
}

export default function TrialStatusHub({
  userId,
  daysRemaining,
  dateAutoNudgeEnabled,
  onNavigateToAutoNudge,
}: TrialStatusHubProps) {
  const [autoNudgeEnabled, setAutoNudgeEnabled] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkAutoNudgeStatus = async () => {
      if (!userId) {
        setIsLoading(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('sms_scheduled_messages')
          .select('id')
          .eq('user_id', userId)
          .eq('purpose', 'auto-nudge')
          .eq('status', 'ACCEPTED')
          .eq('enabled', true)
          .limit(1)

        if (error) {
          setAutoNudgeEnabled(false)
        } else {
          setAutoNudgeEnabled(data && data.length > 0)
        }
      } catch {
        setAutoNudgeEnabled(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAutoNudgeStatus()
  }, [userId])

  const nextNudgeDate = dateAutoNudgeEnabled ? calculateNextNudgeDate(dateAutoNudgeEnabled) : null
  const isNextNudgeInPast = nextNudgeDate && nextNudgeDate < new Date()
  const daysPassed = TRIAL_DAYS - daysRemaining
  const progressPercent = Math.min(100, Math.max(0, (daysPassed / TRIAL_DAYS) * 100))

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="mb-4"
    >
      {/* Status line */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-[#bdbdbd] mb-2">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          <span><span className="text-white font-medium">{daysRemaining}</span> days left</span>
        </div>
        
        <span className="text-white/30">•</span>
        
        <div className="flex items-center gap-1.5">
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Zap className={`w-3.5 h-3.5 ${autoNudgeEnabled ? 'text-lime-300' : ''}`} />
          )}
          <span>
            Auto-Nudge{' '}
            {isLoading ? '...' : autoNudgeEnabled ? (
              <span className="text-lime-300 font-medium">ON</span>
            ) : (
              <span className="text-[#9ca3af]">OFF</span>
            )}
          </span>
        </div>

        {!isLoading && autoNudgeEnabled && nextNudgeDate && (
          <>
            <span className="text-white/30">•</span>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>
                {!isNextNudgeInPast ? formatNextNudgeDate(nextNudgeDate) : 'Mondays 10am'}
              </span>
            </div>
          </>
        )}

        {!isLoading && !autoNudgeEnabled && (
          <button
            onClick={onNavigateToAutoNudge}
            className="inline-flex items-center gap-0.5 text-lime-300 hover:text-lime-200 font-medium transition-colors"
          >
            Enable
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
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
