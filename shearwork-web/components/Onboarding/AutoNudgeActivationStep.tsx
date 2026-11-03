'use client'

import { useState, useEffect } from 'react'
import { CalendarClock, Check, Info, Loader2 } from 'lucide-react'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'

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
  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState(false)
  const [openingsCount, setOpeningsCount] = useState<number | null>(null)
  const [userId, setUserId] = useState<string>('')
  const [alreadyEnabled, setAlreadyEnabled] = useState(false)
  const [firstNudgeDate, setFirstNudgeDate] = useState<string>('')
  const [isBarelyLate, setIsBarelyLate] = useState(false)

  useEffect(() => {
    checkOpenings()
  }, [])

  const calculateFirstNudgeDate = (enabledDateUTC: string): string => {
    // Convert UTC to Toronto time
    const enabledDate = new Date(enabledDateUTC)
    const torontoTime = new Date(enabledDate.toLocaleString('en-US', { timeZone: 'America/Toronto' }))
    
    const dayOfWeek = torontoTime.getDay() // 0 = Sunday, 1 = Monday, etc.
    const hour = torontoTime.getHours()
    
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' }))
    let targetDate = new Date(now)
    
    // Monday (1) after 10am to Wednesday (3): send tomorrow (enabled date + 1 day)
    if ((dayOfWeek === 1 && hour >= 10) || dayOfWeek === 2 || dayOfWeek === 3) {
      targetDate = new Date(torontoTime)
      targetDate.setDate(targetDate.getDate() + 1)
    }
    // Thursday (4) to Sunday (0): send next Monday
    else if (dayOfWeek >= 4 || dayOfWeek === 0) {
      const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
      targetDate.setDate(targetDate.getDate() + daysUntilMonday)
    }
    // Monday before 10am: send today at 10am
    else {
      // targetDate is already set to today
    }
    
    const dayName = targetDate.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Toronto' })
    const monthName = targetDate.toLocaleDateString('en-US', { month: 'long', timeZone: 'America/Toronto' })
    const day = targetDate.getDate()
    const year = targetDate.getFullYear()
    
    return `${dayName}, ${monthName} ${day}, ${year}`
  }

  const checkOpenings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')

      setUserId(user.id)

      // Check if already enabled (date_autonudge_enabled is NOT null)
      const { data: profile } = await supabase
        .from('profiles')
        .select('date_autonudge_enabled')
        .eq('user_id', user.id)
        .single()

      // If date_autonudge_enabled has a value, they've already activated
      if (profile?.date_autonudge_enabled) {
        const enabledDate = new Date(profile.date_autonudge_enabled)
        const torontoTime = new Date(enabledDate.toLocaleString('en-US', { timeZone: 'America/Toronto' }))
        const dayOfWeek = torontoTime.getDay()
        const hour = torontoTime.getHours()
        const barelyLate = (dayOfWeek === 1 && hour >= 10) || dayOfWeek === 2 || dayOfWeek === 3
        
        setIsBarelyLate(barelyLate)
        setAlreadyEnabled(true)
        setFirstNudgeDate(calculateFirstNudgeDate(profile.date_autonudge_enabled))
        setLoading(false)
        return
      }

      // Query the table for current ISO week (Monday-Sunday)
      
      // Calculate current week start (Monday) and end (Sunday)
      const now = new Date()
      const dayOfWeek = now.getDay()
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek // Monday
      const currentWeekStart = new Date(now)
      currentWeekStart.setDate(now.getDate() + diff)
      currentWeekStart.setHours(0, 0, 0, 0)
      
      const currentWeekEnd = new Date(currentWeekStart)
      currentWeekEnd.setDate(currentWeekStart.getDate() + 6) // Sunday
      currentWeekEnd.setHours(23, 59, 59, 999)

      const { data: availabilityData, error: availabilityError } = await supabase
        .from('availability_daily_summary')
        .select('slot_count')
        .eq('user_id', user.id)
        .gte('slot_date', currentWeekStart.toISOString().split('T')[0])
        .lte('slot_date', currentWeekEnd.toISOString().split('T')[0])

      if (availabilityError) {
        console.error('Error fetching availability:', availabilityError)
        throw availabilityError
      }

      // Sum up all slot_count values for the week
      const totalOpenings = availabilityData?.reduce((sum, row) => sum + (row.slot_count || 0), 0) || 0
      setOpeningsCount(totalOpenings)
    } catch (error) {
      console.error('Error checking openings:', error)
      toast.error('Failed to check availability')
      setOpeningsCount(0)
    } finally {
      setLoading(false)
    }
  }

  const handleActivate = async () => {
    setActivating(true)

    try {
      // Send confirmation SMS
      const smsResponse = await fetch('/api/onboarding/send-confirmation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!smsResponse.ok) {
        const errorData = await smsResponse.json()
        throw new Error(errorData.error || 'Failed to send confirmation SMS')
      }

      // Update database
      const { error } = await supabase
        .from('profiles')
        .update({
          date_autonudge_enabled: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)

      if (error) throw error

      const enabledDate = new Date().toISOString()
      const enabledDateObj = new Date(enabledDate)
      const torontoTime = new Date(enabledDateObj.toLocaleString('en-US', { timeZone: 'America/Toronto' }))
      const dayOfWeek = torontoTime.getDay()
      const hour = torontoTime.getHours()
      const barelyLate = (dayOfWeek === 1 && hour >= 10) || dayOfWeek === 2 || dayOfWeek === 3
      
      setIsBarelyLate(barelyLate)
      setFirstNudgeDate(calculateFirstNudgeDate(enabledDate))
      
      toast.success('Auto-Nudge activated! Check your phone for confirmation.')
      setAlreadyEnabled(true)
    } catch (error) {
      console.error('Error activating auto-nudge:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to activate Auto-Nudge')
    } finally {
      setActivating(false)
    }
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <div className="min-w-0">
          <h2 className="panel-title">Auto Nudge activation</h2>
          <p className="panel-subtitle">Smart booking reminders to past clients when you have openings</p>
        </div>
      </header>

      <div className="panel-body">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-sage" />
          </div>
        ) : alreadyEnabled ? (
          <div className="space-y-5">
            {/* Success */}
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sage/15">
                <Check className="h-6 w-6 text-sage-bright" strokeWidth={2} />
              </div>
              <div className="space-y-1">
                <h3 className="text-[17px] font-semibold text-ivory">
                  Auto-Nudge system activated
                </h3>
                <p className="text-sm text-gray-400">
                  You should receive a confirmation text shortly
                </p>
              </div>
            </div>

            {/* First nudge */}
            <div className="flex items-start gap-3 rounded-lg border border-white/[0.07] bg-raised p-4">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-sage" strokeWidth={1.75} />
              <div>
                <p className="stat-label">Your first nudge will be sent on</p>
                <p className="mt-1 text-[15px] font-semibold tabular-nums text-ivory">
                  {firstNudgeDate} at 10:00 AM
                </p>
              </div>
            </div>

            {/* What happens next */}
            <div className="rounded-lg border border-white/[0.07] bg-raised p-4">
              <p className="text-sm font-semibold text-ivory">What happens next?</p>
              <ol className="mt-3 space-y-2.5 text-[13px] text-gray-300">
                <li className="flex items-start gap-2.5">
                  <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/[0.12] text-[11px] font-semibold tabular-nums text-gray-400">1</span>
                  <span>You will receive a message from us around the date and time above and you will be asked to say YES to authorize your client auto-nudge</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/[0.12] text-[11px] font-semibold tabular-nums text-gray-400">2</span>
                  <span>Once you do, just sit back and wait for your results. You'll get a summary text every Sunday at 10 PM with your bookings and revenue recovered. You can also view this under the Auto Nudge page's history</span>
                </li>
                {isBarelyLate && (
                  <li className="flex items-start gap-2.5">
                    <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/[0.12] text-[11px] font-semibold tabular-nums text-gray-400">3</span>
                    <span>Since your nudges will be sent out tomorrow and not on a Monday (our normal schedule), your results will still arrive on Sunday at 10 PM</span>
                  </li>
                )}
              </ol>
              {isBarelyLate && (
                <div className="mt-3 flex gap-2 border-t border-white/[0.07] pt-3">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9CCBFF]" strokeWidth={1.75} />
                  <p className="text-xs text-gray-400">
                    Normally, nudges are sent on Mondays and results arrive on Sunday nights. We're making a one-time exception to get you started right away. Next week, your nudges will be back to the normal Monday schedule.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Openings Display */}
            <div className="py-4 text-center">
              <p className="text-[44px] leading-none font-semibold tracking-tight tabular-nums text-ivory">
                {openingsCount !== null ? openingsCount : '—'}
              </p>
              <h3 className="mt-4 text-[17px] font-semibold text-ivory">
                We found {openingsCount || 0} opening{openingsCount !== 1 ? 's' : ''} this week
              </h3>
              <p className="mt-1 text-sm text-gray-400">
                Let Corva help you fill them automatically
              </p>
            </div>

            {/* CTA Button */}
            <button
              type="button"
              onClick={handleActivate}
              disabled={activating}
              className="btn btn-bright btn-lg w-full"
            >
              {activating ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Activating...
                </span>
              ) : (
                'Start My Auto-Nudge System'
              )}
            </button>

            {/* Confirmation Text */}
            <div className="flex gap-2.5 rounded-lg border border-white/[0.07] bg-raised px-3 py-2.5">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#9CCBFF]" strokeWidth={1.75} />
              <p className="text-xs text-gray-400">
                Corva will send smart booking reminders to past clients when you have openings.
                You'll be notified when someone books.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Back and Finish */}
      <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] px-5 py-4">
        <button
          type="button"
          onClick={onBack}
          disabled={activating}
          className="btn btn-ghost"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onFinish}
          disabled={profileLoading || !alreadyEnabled}
          className="btn btn-primary min-w-[140px]"
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
    </section>
  )
}
