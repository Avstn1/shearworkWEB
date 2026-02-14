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
 * 
 * Rules (per Carlo - Task 4):
 * - If enabled Mon-Wed: next nudge = next day at 10am (within 24 hours)
 * - If enabled Thu-Sun: next nudge = following Monday at 10am
 */
function calculateNextNudgeDate(dateEnabled: string): Date {
  const enabled = new Date(dateEnabled)
  const dayOfWeek = enabled.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  
  const nextNudge = new Date(enabled)
  nextNudge.setHours(10, 0, 0, 0) // Always 10am
  
  // Monday = 1, Tuesday = 2, Wednesday = 3
  if (dayOfWeek >= 1 && dayOfWeek <= 3) {
    // Next day at 10am
    nextNudge.setDate(nextNudge.getDate() + 1)
  } else {
    // Thursday (4), Friday (5), Saturday (6), Sunday (0) → next Monday
    const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek)
    nextNudge.setDate(nextNudge.getDate() + daysUntilMonday)
  }
  
  return nextNudge
}

/**
 * Format date for display: "Mon, Feb 17"
 */
function formatNextNudgeDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Get urgency config based on days remaining
 */
function getUrgencyConfig(daysRemaining: number) {
  if (daysRemaining <= 3) {
    return {
      textColor: 'text-red-400',
      progressColor: 'bg-red-500',
      dotColor: 'bg-red-500',
    }
  } else if (daysRemaining <= 7) {
    return {
      textColor: 'text-amber-400',
      progressColor: 'bg-amber-500',
      dotColor: 'bg-amber-500',
    }
  }
  return {
    textColor: 'text-lime-300',
    progressColor: 'bg-lime-300',
    dotColor: 'bg-lime-300',
  }
}

export default function TrialStatusHub({
  userId,
  daysRemaining,
  dateAutoNudgeEnabled,
  onNavigateToAutoNudge,
}: TrialStatusHubProps) {
  const [autoNudgeEnabled, setAutoNudgeEnabled] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check if auto-nudge is actually enabled (has ACCEPTED + enabled messages)
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
          console.error('Error checking auto-nudge status:', error)
          setAutoNudgeEnabled(false)
        } else {
          setAutoNudgeEnabled(data && data.length > 0)
        }
      } catch (err) {
        console.error('Failed to check auto-nudge status:', err)
        setAutoNudgeEnabled(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAutoNudgeStatus()
  }, [userId])

  // Calculate next nudge date if auto-nudge is enabled
  const nextNudgeDate = dateAutoNudgeEnabled
    ? calculateNextNudgeDate(dateAutoNudgeEnabled)
    : null
  
  // Check if next nudge is in the past (already happened - nudges now run weekly on Monday)
  const isNextNudgeInPast = nextNudgeDate && nextNudgeDate < new Date()
  
  // Calculate progress
  const daysPassed = TRIAL_DAYS - daysRemaining
  const progressPercent = Math.min(100, Math.max(0, (daysPassed / TRIAL_DAYS) * 100))
  
  const urgency = getUrgencyConfig(daysRemaining)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mb-4 rounded-2xl border border-white/10 bg-black/30 p-4"
    >
      {/* Top row: Stats */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-3">
        {/* Days remaining */}
        <div className="flex items-center gap-2">
          <Calendar className={`w-4 h-4 ${urgency.textColor}`} />
          <span className="text-sm text-white font-medium">
            <span className={`font-bold ${urgency.textColor}`}>{daysRemaining}</span>
            {' '}day{daysRemaining !== 1 ? 's' : ''} left
          </span>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-4 bg-white/20" />

        {/* Auto-Nudge status */}
        <div className="flex items-center gap-2">
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-[#9ca3af] animate-spin" />
          ) : (
            <Zap className={`w-4 h-4 ${autoNudgeEnabled ? 'text-lime-300' : 'text-[#9ca3af]'}`} />
          )}
          <span className="text-sm text-white font-medium">
            Auto-Nudge:{' '}
            {isLoading ? (
              <span className="text-[#9ca3af]">...</span>
            ) : autoNudgeEnabled ? (
              <span className="text-lime-300">ON</span>
            ) : (
              <span className="text-[#9ca3af]">OFF</span>
            )}
          </span>
        </div>

        {/* Divider */}
        {!isLoading && autoNudgeEnabled && (
          <>
            <div className="hidden sm:block w-px h-4 bg-white/20" />
            <div className="flex items-center gap-1.5 text-sm text-[#bdbdbd]">
              <Clock className="w-3.5 h-3.5" />
              {nextNudgeDate && !isNextNudgeInPast ? (
                <span>Next: {formatNextNudgeDate(nextNudgeDate)}</span>
              ) : (
                <span>Mondays at 10am</span>
              )}
            </div>
          </>
        )}

        {/* Enable button (when OFF) */}
        {!isLoading && !autoNudgeEnabled && (
          <button
            onClick={onNavigateToAutoNudge}
            className="inline-flex items-center gap-1 text-sm font-medium text-lime-300 hover:text-lime-200 transition-colors"
          >
            Enable
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="relative">
        <div className="flex items-center justify-between text-[10px] text-[#9ca3af] mb-1">
          <span>Day {daysPassed + 1} of {TRIAL_DAYS}</span>
          <span>{Math.round(progressPercent)}%</span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className={`h-full ${urgency.progressColor} rounded-full`}
          />
        </div>
      </div>
    </motion.div>
  )
}
