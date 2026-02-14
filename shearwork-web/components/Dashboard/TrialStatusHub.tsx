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
 * Format date for display: "Mon, Feb 17 at 10:00 AM"
 */
function formatNextNudgeDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }
  const dateStr = date.toLocaleDateString('en-US', options)
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  return `${dateStr} at ${timeStr}`
}

/**
 * Get urgency config based on days remaining
 */
function getUrgencyConfig(daysRemaining: number) {
  if (daysRemaining <= 3) {
    return {
      gradient: 'from-red-500/20 to-rose-600/10',
      border: 'border-red-500/30',
      glow: 'bg-red-500/10',
      textColor: 'text-red-400',
      iconColor: 'text-red-400',
      progressColor: 'bg-red-500',
      label: 'Ending soon',
    }
  } else if (daysRemaining <= 7) {
    return {
      gradient: 'from-amber-500/20 to-orange-600/10',
      border: 'border-amber-500/30',
      glow: 'bg-amber-500/10',
      textColor: 'text-amber-400',
      iconColor: 'text-amber-400',
      progressColor: 'bg-amber-500',
      label: 'Wrapping up',
    }
  }
  return {
    gradient: 'from-lime-300/20 to-green-500/10',
    border: 'border-lime-300/30',
    glow: 'bg-lime-300/10',
    textColor: 'text-lime-300',
    iconColor: 'text-lime-300',
    progressColor: 'bg-lime-300',
    label: 'Active trial',
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
  
  // Calculate progress percentage
  const daysPassed = TRIAL_DAYS - daysRemaining
  const progressPercent = Math.min(100, Math.max(0, (daysPassed / TRIAL_DAYS) * 100))
  
  const urgency = getUrgencyConfig(daysRemaining)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-4"
    >
      {/* Header */}
      <p className="text-[0.65rem] uppercase tracking-[0.25em] text-[#9ca3af] mb-3">
        Trial Status
      </p>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Days Remaining Card */}
        <div className={`relative overflow-hidden bg-gradient-to-br ${urgency.gradient} ${urgency.border} border rounded-2xl p-4 md:p-5`}>
          {/* Glow effect */}
          <div className={`absolute top-0 right-0 w-32 h-32 ${urgency.glow} rounded-full blur-3xl`} />
          
          <div className="relative">
            {/* Icon and Label */}
            <div className="flex items-center gap-2 mb-3">
              <Calendar className={`w-4 h-4 ${urgency.iconColor}`} />
              <span className={`text-xs font-medium ${urgency.textColor}`}>
                {urgency.label}
              </span>
            </div>
            
            {/* Days Count */}
            <div className="flex items-baseline gap-2 mb-1">
              <span className={`text-4xl md:text-5xl font-bold text-white`}>
                {daysRemaining}
              </span>
              <span className={`text-base md:text-lg ${urgency.textColor}`}>
                day{daysRemaining !== 1 ? 's' : ''} left
              </span>
            </div>
            
            {/* Progress Bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-[10px] text-[#9ca3af] mb-1.5">
                <span>Day {daysPassed + 1} of {TRIAL_DAYS}</span>
                <span>{Math.round(progressPercent)}% complete</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={`h-full ${urgency.progressColor} rounded-full`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Auto-Nudge Status Card */}
        <div className={`relative overflow-hidden border rounded-2xl p-4 md:p-5 ${
          autoNudgeEnabled 
            ? 'bg-gradient-to-br from-lime-300/20 to-green-500/10 border-lime-300/30' 
            : 'bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10'
        }`}>
          {/* Glow effect */}
          {autoNudgeEnabled && (
            <div className="absolute top-0 right-0 w-32 h-32 bg-lime-300/10 rounded-full blur-3xl" />
          )}
          
          <div className="relative">
            {/* Icon and Label */}
            <div className="flex items-center gap-2 mb-3">
              {isLoading ? (
                <Loader2 className="w-4 h-4 text-[#9ca3af] animate-spin" />
              ) : (
                <Zap className={`w-4 h-4 ${autoNudgeEnabled ? 'text-lime-300' : 'text-[#9ca3af]'}`} />
              )}
              <span className={`text-xs font-medium ${autoNudgeEnabled ? 'text-lime-300' : 'text-[#9ca3af]'}`}>
                Auto-Nudge
              </span>
            </div>
            
            {isLoading ? (
              <div className="space-y-2">
                <div className="h-8 w-16 bg-white/10 rounded animate-pulse" />
                <div className="h-4 w-32 bg-white/10 rounded animate-pulse" />
              </div>
            ) : autoNudgeEnabled ? (
              <>
                {/* ON Status */}
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-4xl md:text-5xl font-bold text-white">ON</span>
                </div>
                
                {/* Next Nudge Info */}
                <div className="flex items-center gap-1.5 mt-3 text-[#bdbdbd]">
                  <Clock className="w-3.5 h-3.5" />
                  {nextNudgeDate && !isNextNudgeInPast ? (
                    <span className="text-xs">
                      Next: {formatNextNudgeDate(nextNudgeDate)}
                    </span>
                  ) : (
                    <span className="text-xs">
                      Running weekly on Mondays
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* OFF Status */}
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-4xl md:text-5xl font-bold text-[#6b7280]">OFF</span>
                </div>
                
                {/* Enable Button */}
                <button
                  onClick={onNavigateToAutoNudge}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-lime-300 hover:bg-lime-400 text-black text-sm font-semibold rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(163,230,53,0.3)] hover:shadow-[0_0_20px_rgba(163,230,53,0.5)]"
                >
                  Enable Auto-Nudge
                  <ChevronRight className="w-4 h-4" />
                </button>
                
                <p className="text-[10px] text-[#9ca3af] mt-3">
                  Automatically bring back past clients
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
