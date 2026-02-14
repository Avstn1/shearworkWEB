'use client'

import { useEffect, useState } from 'react'
import { Calendar, Zap, ChevronRight, Loader2 } from 'lucide-react'
import { supabase } from '@/utils/supabaseClient'

interface TrialStatusHubProps {
  userId: string
  daysRemaining: number
  dateAutoNudgeEnabled: string | null
  onNavigateToAutoNudge: () => void
}

/**
 * Calculate the next nudge date based on when auto-nudge was enabled.
 * 
 * Rules (per Carlo):
 * - If enabled Mon-Wed: next nudge = next day at 10am
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
        // Check for any auto-nudge messages that are ACCEPTED and enabled
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
  
  // Check if next nudge is in the past (already happened)
  const isNextNudgeInPast = nextNudgeDate && nextNudgeDate < new Date()

  // Determine urgency styling based on days remaining
  const getUrgencyStyles = () => {
    if (daysRemaining <= 3) {
      return {
        borderColor: 'border-red-500/30',
        daysColor: 'text-red-400',
        bgGlow: 'shadow-[0_0_20px_-5px_rgba(239,68,68,0.3)]',
      }
    } else if (daysRemaining <= 7) {
      return {
        borderColor: 'border-amber-500/30',
        daysColor: 'text-amber-400',
        bgGlow: '',
      }
    }
    return {
      borderColor: 'border-white/10',
      daysColor: 'text-white',
      bgGlow: '',
    }
  }

  const urgency = getUrgencyStyles()

  return (
    <div
      className={`mb-4 rounded-2xl border ${urgency.borderColor} bg-black/30 p-4 md:p-5 ${urgency.bgGlow} transition-all duration-300`}
    >
      {/* Header */}
      <p className="text-[0.65rem] uppercase tracking-[0.25em] text-[#9ca3af]">
        Trial Status
      </p>

      {/* Content Grid */}
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Days Remaining */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#73aa57]/20">
            <Calendar className="h-5 w-5 text-[#73aa57]" />
          </div>
          <div>
            <p className={`text-2xl font-bold ${urgency.daysColor}`}>
              {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left
            </p>
            <p className="text-xs text-[#9ca3af]">in your free trial</p>
          </div>
        </div>

        {/* Auto-Nudge Status */}
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              autoNudgeEnabled ? 'bg-[#73aa57]/20' : 'bg-white/10'
            }`}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 text-[#9ca3af] animate-spin" />
            ) : (
              <Zap
                className={`h-5 w-5 ${
                  autoNudgeEnabled ? 'text-[#73aa57]' : 'text-[#9ca3af]'
                }`}
              />
            )}
          </div>
          <div className="flex-1">
            {isLoading ? (
              <div className="h-6 w-24 bg-white/10 rounded animate-pulse" />
            ) : autoNudgeEnabled ? (
              <>
                <p className="text-sm font-semibold text-white">
                  Auto-Nudge:{' '}
                  <span className="text-[#73aa57]">ON</span>
                </p>
                {nextNudgeDate && !isNextNudgeInPast && (
                  <p className="text-xs text-[#9ca3af]">
                    Next nudge: {formatNextNudgeDate(nextNudgeDate)}
                  </p>
                )}
                {nextNudgeDate && isNextNudgeInPast && (
                  <p className="text-xs text-[#9ca3af]">
                    Nudges are running weekly
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-white">
                  Auto-Nudge:{' '}
                  <span className="text-[#9ca3af]">OFF</span>
                </p>
                <button
                  onClick={onNavigateToAutoNudge}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#73aa57] hover:text-[#8fc76e] transition-colors"
                >
                  Enable Auto-Nudge
                  <ChevronRight className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
