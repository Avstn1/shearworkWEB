'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Zap, ChevronRight, ChevronDown, Loader2, Clock, DollarSign } from 'lucide-react'
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

// Calculate next nudge date based on TODAY (not when enabled)
// Nudges go out every Monday at 10am Toronto time
// If it's Monday before 10am, next nudge is today at 10am
// Otherwise, next nudge is the following Monday at 10am
function calculateNextNudgeDate(): string | null {
  const now = new Date()
  
  // Convert to Toronto timezone
  const torontoNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Toronto' }))
  const dayOfWeek = torontoNow.getDay() // 0 = Sunday, 1 = Monday, etc.
  const hour = torontoNow.getHours()
  
  const targetDate = new Date(torontoNow)
  
  // If it's Monday before 10am, next nudge is today at 10am
  if (dayOfWeek === 1 && hour < 10) {
    targetDate.setHours(10, 0, 0, 0)
  } 
  // Otherwise, calculate next Monday at 10am
  else {
    // Days until next Monday: if Sunday (0) -> 1 day, if Monday after 10am -> 7 days, etc.
    const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 7 : 8 - dayOfWeek
    targetDate.setDate(targetDate.getDate() + daysUntilMonday)
    targetDate.setHours(10, 0, 0, 0)
  }
  
  // Format: "Monday, Feb 24 at 10:00 AM"
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
  const [isExpanded, setIsExpanded] = useState(false)

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
  // Only show next nudge date if Auto-Nudge is active
  const nextNudgeDate = autoNudgeStatus === 'active' ? calculateNextNudgeDate() : null

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-4"
    >
      <div className="bg-[#0d0f0e] border border-white/10 rounded-2xl shadow-lg">
        
        {/* ============================================ */}
        {/* MOBILE LAYOUT - Collapsible (visible < md)  */}
        {/* ============================================ */}
        <div className="md:hidden">
          {/* Collapsed row - always visible, tappable */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center gap-2 px-4 py-3"
          >
            {/* Status dot */}
            <div className={`w-2 h-2 rounded-full shrink-0 ${getUrgencyColor(daysRemaining)}`} />
            
            {/* Days remaining */}
            <span className="text-sm text-[#9ca3af] shrink-0">
              {daysRemaining} days left
            </span>
            
            {/* Auto-Nudge status */}
            <div className="flex items-center gap-1 shrink-0">
              {autoNudgeStatus === 'loading' ? (
                <Loader2 className="w-3 h-3 text-[#9ca3af] animate-spin" />
              ) : (
                <Zap className={`w-3 h-3 ${autoNudgeStatus === 'active' ? 'text-lime-300' : 'text-[#9ca3af]'}`} />
              )}
              <span className={`text-xs font-medium ${autoNudgeStatus === 'active' ? 'text-lime-300' : 'text-[#9ca3af]'}`}>
                {autoNudgeStatus === 'loading' ? '...' : autoNudgeStatus === 'active' ? 'Active' : 'Inactive'}
              </span>
            </div>
            
            {/* Progress bar */}
            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden mx-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className={`h-full ${getUrgencyColor(daysRemaining)} rounded-full`}
              />
            </div>
            
            {/* Chevron */}
            <ChevronDown 
              className={`w-4 h-4 text-[#9ca3af] shrink-0 transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`} 
            />
          </button>
          
          {/* Expanded content */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
                  {/* Auto-Nudge status */}
                  <div className="flex items-center gap-2">
                    {autoNudgeStatus === 'loading' ? (
                      <Loader2 className="w-4 h-4 text-[#9ca3af] animate-spin" />
                    ) : (
                      <Zap className={`w-4 h-4 ${autoNudgeStatus === 'active' ? 'text-lime-300' : 'text-[#9ca3af]'}`} />
                    )}
                    <span className="text-sm">
                      <span className="text-[#9ca3af]">Auto-Nudge: </span>
                      <span className={autoNudgeStatus === 'active' ? 'text-lime-300 font-medium' : 'text-[#9ca3af]'}>
                        {autoNudgeStatus === 'loading' ? '...' : autoNudgeStatus === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </span>
                  </div>
                  
                  {/* Next nudge date - only when active */}
                  {autoNudgeStatus === 'active' && nextNudgeDate && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-sky-400" />
                      <span className="text-sm">
                        <span className="text-[#9ca3af]">Next: </span>
                        <span className="text-sky-400 font-medium">{nextNudgeDate}</span>
                      </span>
                    </div>
                  )}
                  
                  {/* Revenue - only when active */}
                  {autoNudgeStatus === 'active' && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-[#9ca3af]" />
                      {isLoadingRevenue ? (
                        <Loader2 className="w-4 h-4 animate-spin text-lime-300" />
                      ) : revenueRecovered && revenueRecovered > 0 ? (
                        <span className="text-sm">
                          <span className="text-lime-300 font-bold">${revenueRecovered}</span>
                          <span className="text-[#9ca3af] ml-1">recovered this week</span>
                        </span>
                      ) : (
                        <span className="text-sm text-[#9ca3af]">No recoveries yet</span>
                      )}
                    </div>
                  )}
                  
                  {/* See more link */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onNavigateToAutoNudge()
                    }}
                    className="flex items-center gap-1 text-sm text-lime-300 hover:text-lime-200 font-medium transition-colors pt-1"
                  >
                    See more
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ============================================ */}
        {/* DESKTOP LAYOUT - Horizontal (visible >= md) */}
        {/* ============================================ */}
        <div className="hidden md:block p-4">
          {/* Status row */}
          <div className="flex items-center gap-4 mb-3 overflow-x-auto">
            {/* Days remaining */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-7 h-7 rounded-lg bg-lime-300/20 flex items-center justify-center shrink-0">
                <Calendar className="w-3.5 h-3.5 text-lime-300" />
              </div>
              <span className="text-sm whitespace-nowrap">
                <span className="text-base font-bold text-lime-300">{daysRemaining}</span>
                <span className="text-[#bdbdbd] ml-1">days of trial left</span>
              </span>
            </div>
            
            {/* Auto-Nudge status */}
            <div className="flex items-center gap-2 shrink-0">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                autoNudgeStatus === 'active' ? 'bg-lime-300/20' : 'bg-white/10'
              }`}>
                {autoNudgeStatus === 'loading' ? (
                  <Loader2 className="w-3.5 h-3.5 text-[#9ca3af] animate-spin" />
                ) : (
                  <Zap className={`w-3.5 h-3.5 ${autoNudgeStatus === 'active' ? 'text-lime-300' : 'text-[#9ca3af]'}`} />
                )}
              </div>
              <span className="text-sm whitespace-nowrap">
                <span className={`font-semibold ${autoNudgeStatus === 'active' ? 'text-lime-300' : 'text-[#9ca3af]'}`}>
                  {autoNudgeStatus === 'loading' ? '...' : autoNudgeStatus === 'active' ? 'Active' : 'Not active'}
                </span>
              </span>
            </div>

            {/* Next nudge date - only when active */}
            {autoNudgeStatus === 'active' && nextNudgeDate && (
              <div className="flex items-center gap-2 shrink-0">
                <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="text-sm whitespace-nowrap">
                  <span className="font-medium text-sky-400">{nextNudgeDate}</span>
                </span>
              </div>
            )}

            {/* Revenue when active */}
            {autoNudgeStatus === 'active' && (
              <div className="flex items-center gap-2 shrink-0">
                {isLoadingRevenue ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-lime-300" />
                ) : revenueRecovered && revenueRecovered > 0 ? (
                  <span className="text-sm whitespace-nowrap">
                    <span className="text-base font-bold text-lime-300">${revenueRecovered}</span>
                    <span className="text-[#9ca3af] ml-1">this week</span>
                  </span>
                ) : (
                  <span className="text-sm text-[#9ca3af] whitespace-nowrap">No recoveries yet</span>
                )}
              </div>
            )}

            {/* Spacer + See more */}
            <div className="flex-1 min-w-0" />
            <button
              onClick={onNavigateToAutoNudge}
              className="flex items-center gap-1 text-sm text-lime-300 hover:text-lime-200 font-medium transition-colors shrink-0"
            >
              See more
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Progress bar with percentage */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className={`h-full ${getUrgencyColor(daysRemaining)} rounded-full`}
              />
            </div>
            <span className="text-xs font-medium text-[#bdbdbd] tabular-nums shrink-0">{Math.round(progressPercent)}%</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
