'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Zap, ChevronRight, Loader2, Clock } from 'lucide-react'
import { supabase } from '@/utils/supabaseClient'
import { TRIAL_DAYS } from '@/lib/constants/trial'

interface TrialStatusHubProps {
  userId: string
  daysRemaining: number
  dateAutoNudgeEnabled?: string | null
  onNavigateToAutoNudge: () => void
}

type AutoNudgeStatus = 'loading' | 'not_active' | 'active'

function getUrgencyColor(daysRemaining: number) {
  if (daysRemaining <= 3) return 'bg-red-500'
  if (daysRemaining <= 7) return 'bg-amber-500'
  return 'bg-lime-300'
}

function getISOWeekNumber(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

// Calculate next nudge date based on when auto-nudge was enabled
// Rules:
// - Monday before 10am → today (Monday) at 10am
// - Monday after 10am, Tuesday, Wednesday → next day at 10am
// - Thursday, Friday, Saturday, Sunday → next Monday at 10am
function calculateNextNudgeDate(enabledDateUTC: string): string {
  const enabledDate = new Date(enabledDateUTC)
  const torontoTime = new Date(enabledDate.toLocaleString('en-US', { timeZone: 'America/Toronto' }))
  
  const dayOfWeek = torontoTime.getDay() // 0 = Sunday, 1 = Monday, etc.
  const hour = torontoTime.getHours()
  
  // Always start from the enabled date, not "now"
  const targetDate = new Date(torontoTime)
  
  // Monday (1) after 10am, Tuesday (2), Wednesday (3): send next day at 10am
  if ((dayOfWeek === 1 && hour >= 10) || dayOfWeek === 2 || dayOfWeek === 3) {
    targetDate.setDate(targetDate.getDate() + 1)
  }
  // Thursday (4) to Sunday (0): send next Monday at 10am
  else if (dayOfWeek >= 4 || dayOfWeek === 0) {
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
    targetDate.setDate(targetDate.getDate() + daysUntilMonday)
  }
  // Monday before 10am: send today (Monday) at 10am - targetDate already correct
  
  const dayName = targetDate.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Toronto' })
  const monthName = targetDate.toLocaleDateString('en-US', { month: 'short', timeZone: 'America/Toronto' })
  const day = targetDate.getDate()
  
  return `${dayName}, ${monthName} ${day} at 10:00 AM`
}

export default function TrialStatusHub({
  userId,
  daysRemaining,
  dateAutoNudgeEnabled,
  onNavigateToAutoNudge,
}: TrialStatusHubProps) {
  const [autoNudgeStatus, setAutoNudgeStatus] = useState<AutoNudgeStatus>('loading')
  const [revenueRecovered, setRevenueRecovered] = useState<number | null>(null)
  const [isLoadingRevenue, setIsLoadingRevenue] = useState(false)

  // Fetch Auto-Nudge status
  // Active if: dateAutoNudgeEnabled is set OR sms_scheduled_messages has status='ACCEPTED' + enabled=true
  useEffect(() => {
    const checkAutoNudgeStatus = async () => {
      if (!userId) {
        setAutoNudgeStatus('not_active')
        return
      }

      // If dateAutoNudgeEnabled is set, user has activated via onboarding
      if (dateAutoNudgeEnabled) {
        setAutoNudgeStatus('active')
        return
      }

      // Otherwise check sms_scheduled_messages for active auto-nudge
      try {
        const { data, error } = await supabase
          .from('sms_scheduled_messages')
          .select('id, status, enabled')
          .eq('user_id', userId)
          .eq('purpose', 'auto-nudge')

        if (error || !data || data.length === 0) {
          setAutoNudgeStatus('not_active')
          return
        }

        const hasActive = data.some(msg => msg.status === 'ACCEPTED' && msg.enabled === true)
        setAutoNudgeStatus(hasActive ? 'active' : 'not_active')
      } catch {
        setAutoNudgeStatus('not_active')
      }
    }

    checkAutoNudgeStatus()
  }, [userId, dateAutoNudgeEnabled])

  // Fetch revenue when active
  useEffect(() => {
    const fetchRevenue = async () => {
      if (autoNudgeStatus !== 'active' || !userId) {
        setRevenueRecovered(null)
        return
      }

      setIsLoadingRevenue(true)
      try {
        const currentWeek = getISOWeekNumber(new Date())
        
        const { data, error } = await supabase
          .from('barber_nudge_success')
          .select('prices')
          .eq('user_id', userId)
          .eq('iso_week_number', currentWeek)
          .single()

        if (error || !data?.prices || data.prices.length === 0) {
          setRevenueRecovered(0)
          return
        }

        const total = data.prices.reduce((sum: number, p: string | number) => sum + Number(p), 0)
        setRevenueRecovered(total)
      } catch {
        setRevenueRecovered(0)
      } finally {
        setIsLoadingRevenue(false)
      }
    }

    fetchRevenue()
  }, [autoNudgeStatus, userId])

  const daysPassed = TRIAL_DAYS - daysRemaining
  const progressPercent = Math.min(100, Math.max(0, (daysPassed / TRIAL_DAYS) * 100))
  const nextNudgeDate = dateAutoNudgeEnabled ? calculateNextNudgeDate(dateAutoNudgeEnabled) : null

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-4"
    >
      <div className="bg-[#0d0f0e] border border-white/10 rounded-2xl p-4 shadow-lg">
        {/* Status row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
          {/* Days remaining */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-lime-300/20 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-lime-300" />
            </div>
            <span className="text-sm">
              <span className="text-lg font-bold text-lime-300">{daysRemaining}</span>
              <span className="text-[#bdbdbd] ml-1">days left</span>
            </span>
          </div>
          
          <span className="text-white/20 text-lg">|</span>
          
          {/* Auto-Nudge status */}
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              autoNudgeStatus === 'active' ? 'bg-lime-300/20' : 'bg-white/10'
            }`}>
              {autoNudgeStatus === 'loading' ? (
                <Loader2 className="w-4 h-4 text-[#9ca3af] animate-spin" />
              ) : (
                <Zap className={`w-4 h-4 ${autoNudgeStatus === 'active' ? 'text-lime-300' : 'text-[#9ca3af]'}`} />
              )}
            </div>
            <span className="text-sm">
              <span className="text-[#bdbdbd]">Auto-Nudge:</span>{' '}
              <span className={`font-semibold ${autoNudgeStatus === 'active' ? 'text-lime-300' : 'text-[#9ca3af]'}`}>
                {autoNudgeStatus === 'loading' ? '...' : autoNudgeStatus === 'active' ? 'Active' : 'Not active'}
              </span>
            </span>
          </div>

          {/* Next nudge date - only when active */}
          {autoNudgeStatus === 'active' && nextNudgeDate && (
            <>
              <span className="text-white/20 text-lg">|</span>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-sky-400" />
                <span className="text-sm">
                  <span className="text-[#bdbdbd]">Next nudge:</span>{' '}
                  <span className="font-medium text-sky-400">{nextNudgeDate}</span>
                </span>
              </div>
            </>
          )}

          {/* Revenue when active */}
          {autoNudgeStatus === 'active' && (
            <>
              <span className="text-white/20 text-lg">|</span>
              <div className="flex items-center gap-2">
                {isLoadingRevenue ? (
                  <Loader2 className="w-4 h-4 animate-spin text-lime-300" />
                ) : revenueRecovered && revenueRecovered > 0 ? (
                  <span className="text-sm">
                    <span className="text-[#bdbdbd]">Recovered:</span>{' '}
                    <span className="text-lg font-bold text-lime-300">${revenueRecovered}</span>
                    <span className="text-[#9ca3af] ml-1">this week</span>
                  </span>
                ) : (
                  <span className="text-sm italic text-[#9ca3af]">Waiting for bookings...</span>
                )}
              </div>
            </>
          )}

          {/* Spacer + See more */}
          <div className="flex-1" />
          <button
            onClick={onNavigateToAutoNudge}
            className="flex items-center gap-1 text-sm text-lime-300 hover:text-lime-200 font-medium transition-colors"
          >
            See more
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Progress bar with percentage */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className={`h-full ${getUrgencyColor(daysRemaining)} rounded-full`}
            />
          </div>
          <span className="text-sm font-medium text-[#bdbdbd] tabular-nums">{Math.round(progressPercent)}%</span>
        </div>
      </div>
    </motion.div>
  )
}
