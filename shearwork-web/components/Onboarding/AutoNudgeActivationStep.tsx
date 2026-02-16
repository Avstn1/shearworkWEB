'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
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
    <div className="space-y-6 animate-fadeInUp min-h-[calc(100vh-340px)]">
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

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          </div>
        ) : alreadyEnabled ? (
          <div className="py-8 space-y-6">
            {/* Success Badge */}
            <div className="flex justify-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400/20 to-[#3af1f7]/20 border-2 border-emerald-400/40">
                <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            {/* Success Message */}
            <div className="text-center space-y-2">
              <h4 className="text-xl font-semibold text-white">
                Auto-Nudge System Activated!
              </h4>
              <p className="text-sm text-gray-400">
                You should receive a confirmation text shortly
              </p>
            </div>

            {/* Info Card */}
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 space-y-3">
              <p className="text-sm text-emerald-200 font-semibold">
                📅 Your first nudge will be sent on:
              </p>
              <p className="text-base text-white font-semibold">
                {firstNudgeDate} at 10:00 AM
              </p>
            </div>

            {/* What happens next */}
            <div className="rounded-xl border border-blue-400/30 bg-blue-400/10 p-4 space-y-3">
              <p className="text-sm text-blue-200 font-semibold">
                What happens next?
              </p>
              <ul className="text-xs text-blue-300 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">1.</span>
                  <span>You will receive a message from us around the date and time above and you will be asked to say YES to authorize your client auto-nudge</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">2.</span>
                  <span>Once you do, just sit back and wait for an update. All updates are sent every Wednesday. You can also view this under the Auto Nudge page's history</span>
                </li>
                {isBarelyLate && (
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">3.</span>
                    <span>Since your nudges will be sent out tomorrow and not on a Monday (our normal schedule), you will receive your update 2 days after you authorize your nudge</span>
                  </li>
                )}
              </ul>
              {isBarelyLate && (
                <div className="mt-3 pt-3 border-t border-blue-400/20">
                  <p className="text-xs text-blue-200 italic">
                    💡 Normally, nudges are sent on Mondays and updates on Wednesdays. We're making a one-time exception to get you started right away. Next week, your nudges will be back to the normal Monday schedule.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Openings Display */}
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400/20 to-[#3af1f7]/20 border-2 border-emerald-400/40 mb-4">
                <span className="text-4xl font-bold text-emerald-300">
                  {openingsCount !== null ? openingsCount : '—'}
                </span>
              </div>
              <h4 className="text-xl font-semibold text-white mb-2">
                We found {openingsCount || 0} opening{openingsCount !== 1 ? 's' : ''} this week
              </h4>
              <p className="text-sm text-gray-400">
                Let Corva help you fill them automatically
              </p>
            </div>

            {/* CTA Button */}
            <button
              type="button"
              onClick={handleActivate}
              disabled={activating}
              className={`w-full py-4 font-semibold text-lg rounded-xl transition-all ${
                activating
                  ? 'bg-white/5 border border-white/10 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#7affc9] to-[#3af1f7] text-black hover:shadow-lg hover:scale-[1.02]'
              }`}
            >
              {activating ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Activating...
                </span>
              ) : (
                'Start My Auto-Nudge System'
              )}
            </button>

            {/* Confirmation Text */}
            <div className="rounded-xl border border-blue-400/30 bg-blue-400/10 p-4">
              <p className="text-xs text-blue-200">
                Corva will send smart booking reminders to past clients when you have openings. 
                You'll be notified when someone books.
              </p>
            </div>
          </div>
        )}

        {/* Back and Finish Buttons */}
        <div className="flex justify-between items-center gap-4 pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={onBack}
            disabled={activating}
            className={`px-6 py-3 font-semibold rounded-xl transition-all ${
              activating
                ? 'bg-white/5 border border-white/10 text-gray-400 cursor-not-allowed'
                : 'bg-white/10 border border-white/20 hover:bg-white/15'
            }`}
          >
            Back
          </button>
          <button
            type="button"
            onClick={onFinish}
            disabled={profileLoading || !alreadyEnabled}
            className={`px-8 py-3 font-semibold rounded-xl transition-all ${
              profileLoading || !alreadyEnabled
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