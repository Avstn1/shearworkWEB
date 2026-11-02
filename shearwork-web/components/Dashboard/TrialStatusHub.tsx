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
  if (daysRemaining <= 3) return 'bg-[#D99A8B]'
  if (daysRemaining <= 7) return 'bg-[#D8C59A]'
  return 'bg-sage'
}



function getISOWeekNumber(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

// Calculate next nudge date based on signup day (dateAutoNudgeEnabled)
// - Mon/Tue/Wed signup → next day at 10am (Tue/Wed/Thu respectively)
// - Thu-Sun signup → next Monday at 10am
// After first nudge, show next Monday at 10am (weekly cycle)
function calculateNextNudgeDate(dateAutoNudgeEnabled: string | null | undefined): string | null {
  if (!dateAutoNudgeEnabled) return null
  
  const now = new Date()
  const torontoNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Toronto' }))
  
  const enabledDate = new Date(dateAutoNudgeEnabled)
  const torontoEnabled = new Date(enabledDate.toLocaleString('en-US', { timeZone: 'America/Toronto' }))
  const signupDayOfWeek = torontoEnabled.getDay() // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  
  // Calculate first nudge date based on signup day
  const firstNudgeDate = new Date(torontoEnabled)
  
  // Mon, Tue, or Wed signup (1, 2, 3) → next day at 10am
  if (signupDayOfWeek >= 1 && signupDayOfWeek <= 3) {
    firstNudgeDate.setDate(firstNudgeDate.getDate() + 1)
    firstNudgeDate.setHours(10, 0, 0, 0)
  } 
  // Thu-Sun signup (0, 4, 5, 6) → next Monday at 10am
  else {
    const daysUntilMonday = signupDayOfWeek === 0 ? 1 : 8 - signupDayOfWeek
    firstNudgeDate.setDate(firstNudgeDate.getDate() + daysUntilMonday)
    firstNudgeDate.setHours(10, 0, 0, 0)
  }
  
  let targetDate: Date
  
  // If first nudge is still in the future, show it
  if (firstNudgeDate > torontoNow) {
    targetDate = firstNudgeDate
  } else {
    // Otherwise, calculate next Monday at 10am
    const currentDayOfWeek = torontoNow.getDay()
    const currentHour = torontoNow.getHours()
    
    targetDate = new Date(torontoNow)
    
    // If it's Monday before 10am, next nudge is today at 10am
    if (currentDayOfWeek === 1 && currentHour < 10) {
      targetDate.setHours(10, 0, 0, 0)
    } else {
      // Calculate next Monday
      const daysUntilMonday = currentDayOfWeek === 0 ? 1 : currentDayOfWeek === 1 ? 7 : 8 - currentDayOfWeek
      targetDate.setDate(targetDate.getDate() + daysUntilMonday)
      targetDate.setHours(10, 0, 0, 0)
    }
  }
  
  // Format: "Monday, Feb 24 at 10:00 AM"
  const dayName = targetDate.toLocaleDateString('en-US', { weekday: 'long' })
  const monthName = targetDate.toLocaleDateString('en-US', { month: 'short' })
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
  const nextNudgeDate = autoNudgeStatus === 'active' ? calculateNextNudgeDate(dateAutoNudgeEnabled) : null

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-4"
    >
      <div className="panel">
        
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
            <span className="text-sm text-muted tabular-nums shrink-0">
              {daysRemaining} days left
            </span>
            
            {/* Auto-Nudge status */}
            <div className="flex items-center gap-1 shrink-0">
              {autoNudgeStatus === 'loading' ? (
                <Loader2 className="w-3 h-3 text-muted animate-spin" />
              ) : (
                <Zap className={`w-3 h-3 ${autoNudgeStatus === 'active' ? 'text-sage-bright' : 'text-muted'}`} strokeWidth={1.75} />
              )}
              <span className={`text-xs font-medium ${autoNudgeStatus === 'active' ? 'text-sage-bright' : 'text-muted'}`}>
                {autoNudgeStatus === 'loading' ? '...' : autoNudgeStatus === 'active' ? 'Auto-Nudge: Active' : 'Auto-Nudge: Inactive'}
              </span>
            </div>
            
            {/* Progress bar */}
            <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden mx-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className={`h-full ${getUrgencyColor(daysRemaining)} rounded-full`}
              />
            </div>
            
            {/* Chevron */}
            <ChevronDown 
              className={`w-4 h-4 text-muted shrink-0 transition-transform duration-200 ${
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
                <div className="px-4 pb-4 space-y-3 border-t border-white/[0.07] pt-3">
                  {/* Auto-Nudge status */}
                  <div className="flex items-center gap-2">
                    {autoNudgeStatus === 'loading' ? (
                      <Loader2 className="w-4 h-4 text-muted animate-spin" />
                    ) : (
                      <Zap className={`w-4 h-4 ${autoNudgeStatus === 'active' ? 'text-sage-bright' : 'text-muted'}`} strokeWidth={1.75} />
                    )}
                    <span className="text-sm">
                      <span className="text-muted">Auto-Nudge: </span>
                      <span className={autoNudgeStatus === 'active' ? 'text-sage-bright font-medium' : 'text-muted'}>
                        {autoNudgeStatus === 'loading' ? '...' : autoNudgeStatus === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </span>
                  </div>
                  
                  {/* Next nudge date - only when active */}
                  {autoNudgeStatus === 'active' && nextNudgeDate && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#A9C0D2]" strokeWidth={1.75} />
                      <span className="text-sm">
                        <span className="text-muted">Next: </span>
                        <span className="text-[#A9C0D2] font-medium">{nextNudgeDate}</span>
                      </span>
                    </div>
                  )}
                  
                  {/* Revenue - only when active */}
                  {autoNudgeStatus === 'active' && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-muted" strokeWidth={1.75} />
                      {isLoadingRevenue ? (
                        <Loader2 className="w-4 h-4 animate-spin text-sage-bright" />
                      ) : revenueRecovered && revenueRecovered > 0 ? (
                        <span className="text-sm">
                          <span className="text-sage-bright font-semibold tabular-nums">${revenueRecovered}</span>
                          <span className="text-muted ml-1">recovered this week</span>
                        </span>
                      ) : (
                        <span className="text-sm text-muted">No recoveries yet</span>
                      )}
                    </div>
                  )}
                  
                  {/* See more link */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onNavigateToAutoNudge()
                    }}
                    className="flex items-center gap-1 text-sm text-sage-bright hover:text-ivory font-medium transition-colors pt-1"
                  >
                    See more
                    <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
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
              <div className="w-7 h-7 rounded-lg bg-sage/[0.12] flex items-center justify-center shrink-0">
                <Calendar className="w-3.5 h-3.5 text-sage-bright" strokeWidth={1.75} />
              </div>
              <span className="text-sm whitespace-nowrap">
                <span className="text-base font-semibold tabular-nums text-ivory">{daysRemaining}</span>
                <span className="text-gray-300 ml-1">days of trial left</span>
              </span>
            </div>
            
            {/* Auto-Nudge status */}
            <div className="flex items-center gap-2 shrink-0">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                autoNudgeStatus === 'active' ? 'bg-sage/[0.12]' : 'bg-white/10'
              }`}>
                {autoNudgeStatus === 'loading' ? (
                  <Loader2 className="w-3.5 h-3.5 text-muted animate-spin" />
                ) : (
                  <Zap className={`w-3.5 h-3.5 ${autoNudgeStatus === 'active' ? 'text-sage-bright' : 'text-muted'}`} strokeWidth={1.75} />
                )}
              </div>
              <span className="text-sm whitespace-nowrap">
                <span className={`font-semibold ${autoNudgeStatus === 'active' ? 'text-sage-bright' : 'text-muted'}`}>
                  {autoNudgeStatus === 'loading' ? '...' : autoNudgeStatus === 'active' ? 'Auto-Nudge: Active' : 'Auto-Nudge: Inactive'}
                </span>
              </span>
            </div>

            {/* Next nudge date - only when active */}
            {autoNudgeStatus === 'active' && nextNudgeDate && (
              <div className="flex items-center gap-2 shrink-0">
                <Clock className="w-3.5 h-3.5 text-[#A9C0D2] shrink-0" strokeWidth={1.75} />
                <span className="text-sm whitespace-nowrap">
                  <span className="font-medium text-[#A9C0D2]">{nextNudgeDate}</span>
                </span>
              </div>
            )}

            {/* Revenue when active */}
            {autoNudgeStatus === 'active' && (
              <div className="flex items-center gap-2 shrink-0">
                {isLoadingRevenue ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-sage-bright" />
                ) : revenueRecovered && revenueRecovered > 0 ? (
                  <span className="text-sm whitespace-nowrap">
                    <span className="text-base font-semibold tabular-nums text-sage-bright">${revenueRecovered}</span>
                    <span className="text-muted ml-1">this week</span>
                  </span>
                ) : (
                  <span className="text-sm text-muted whitespace-nowrap">No recoveries yet</span>
                )}
              </div>
            )}

            {/* Spacer + See more */}
            <div className="flex-1 min-w-0" />
            <button
              onClick={onNavigateToAutoNudge}
              className="flex items-center gap-1 text-sm text-sage-bright hover:text-ivory font-medium transition-colors shrink-0"
            >
              See more
              <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>

          {/* Progress bar with percentage */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className={`h-full ${getUrgencyColor(daysRemaining)} rounded-full`}
              />
            </div>
            <span className="text-xs font-medium text-gray-300 tabular-nums shrink-0">{Math.round(progressPercent)}%</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
