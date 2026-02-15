'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/utils/supabaseClient'
import ConnectAcuityButton from '@/components/ConnectAcuityButton'
import ConnectSquareButton from '@/components/ConnectSquareButton'

interface CalendarStepProps {
  selectedProvider: 'acuity' | 'square' | null
  setSelectedProvider: (value: 'acuity' | 'square' | null) => void
  calendarStatus: {
    acuity: boolean
    square: boolean
    loading: boolean
  }
  acuityCalendars: Array<{ id: number | string; name: string }>
  selectedAcuityCalendar: string
  setSelectedAcuityCalendar: (value: string) => void
  handleBeforeConnectAcuity: () => Promise<boolean>
  handleAcuityConnectSuccess: () => Promise<void>
  handleBeforeConnectSquare: () => Promise<boolean>
  onBack: () => void
  onFinish: () => void
  onSaveCalendar: () => Promise<void>
  isCalendarConnected: boolean
  profileLoading: boolean
}

export default function CalendarStep({
  selectedProvider,
  setSelectedProvider,
  calendarStatus,
  acuityCalendars,
  selectedAcuityCalendar,
  setSelectedAcuityCalendar,
  handleBeforeConnectAcuity,
  handleAcuityConnectSuccess,
  handleBeforeConnectSquare,
  onBack,
  onFinish,
  onSaveCalendar,
  isCalendarConnected,
  profileLoading,
}: CalendarStepProps) {
  const [saving, setSaving] = useState(false)
  const [isCalendarLocked, setIsCalendarLocked] = useState(false)
  const [loadingLockStatus, setLoadingLockStatus] = useState(true)
  const [existingCalendar, setExistingCalendar] = useState<string>('')

  // Check if calendar is already locked on mount
  useEffect(() => {
    checkCalendarLock()
  }, [])

  const checkCalendarLock = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('calendar')
        .eq('user_id', user.id)
        .single()

      if (profile?.calendar) {
        setIsCalendarLocked(true)
        setExistingCalendar(profile.calendar)
        setSelectedAcuityCalendar(profile.calendar)
      }
    } catch (error) {
      console.error('Error checking calendar lock:', error)
    } finally {
      setLoadingLockStatus(false)
    }
  }

  const providerConnected =
    selectedProvider === 'acuity'
      ? calendarStatus.acuity
      : selectedProvider === 'square'
        ? calendarStatus.square
        : false

  // Calendar is selected if: locked (already saved) OR user has selected one
  const isCalendarSelected = isCalendarLocked || (selectedProvider === 'acuity' 
    ? !!selectedAcuityCalendar 
    : selectedProvider === 'square')

  const handleNext = async () => {
    if (!isCalendarSelected) return

    setSaving(true)
    try {
      await onSaveCalendar()
      onFinish()
    } catch (error) {
      console.error('Error saving calendar:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 animate-fadeInUp">
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
        <h3 className="text-sm font-semibold text-white uppercase tracking-[0.2em]">Connect your calendar</h3>
        <p className="text-xs text-gray-400">
          Choose the provider you want to sync. You can change this later in Settings.
        </p>
        
        <div className="space-y-4">
          {(
            [
              {
                id: 'acuity',
                title: 'Acuity',
                description: 'Recommended for booking management',
                helper: 'Best if you manage appointments in Acuity Scheduling.',
              },
              {
                id: 'square',
                title: 'Square',
                description: 'Best if you take payments + bookings in Square',
                helper: 'Ideal if your POS and scheduling live in Square.',
              },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setSelectedProvider(option.id)}
              className={`w-full rounded-2xl border p-4 text-left transition ${
                selectedProvider === option.id
                  ? 'border-emerald-400/40 bg-emerald-400/10'
                  : 'border-white/10 bg-black/20 hover:border-white/30'
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-1 h-4 w-4 rounded-full border ${
                    selectedProvider === option.id
                      ? 'border-emerald-300 bg-emerald-300'
                      : 'border-white/30'
                  }`}
                />
                <div>
                  <p className="text-sm font-semibold text-white">{option.title}</p>
                  <p className="text-xs text-gray-300">{option.description}</p>
                  <p className="text-[0.7rem] text-gray-400 mt-1">{option.helper}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {selectedProvider && (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-sm font-semibold text-white">
                  {selectedProvider === 'acuity' ? 'Acuity selected' : 'Square selected'}
                </p>
                <p className="text-xs text-gray-400">
                  {providerConnected
                    ? 'Calendar connected successfully.'
                    : 'Connect to begin syncing appointments.'}
                </p>
              </div>
              {!providerConnected && (
                <div>
                  {selectedProvider === 'acuity' ? (
                    <ConnectAcuityButton
                      variant="secondary"
                      onBeforeConnect={handleBeforeConnectAcuity}
                      onConnectSuccess={handleAcuityConnectSuccess}
                      disabled={calendarStatus.loading}
                      disabledReason={calendarStatus.loading ? 'Checking calendar status' : undefined}
                      className="w-full"
                    />
                  ) : (
                    <ConnectSquareButton
                      variant="secondary"
                      onBeforeConnect={handleBeforeConnectSquare}
                      disabled={calendarStatus.loading}
                      disabledReason={calendarStatus.loading ? 'Checking calendar status' : undefined}
                      className="w-full"
                    />
                  )}
                </div>
              )}
              {providerConnected && selectedProvider === 'acuity' && acuityCalendars.length > 0 && (
                <div className="space-y-3">
                  <div>
                    <label className="block mb-2 text-sm font-semibold text-white">Select Calendar</label>
                    <select
                      value={isCalendarLocked ? existingCalendar : selectedAcuityCalendar}
                      onChange={e => setSelectedAcuityCalendar(e.target.value)}
                      disabled={isCalendarLocked}
                      className={`w-full p-3 rounded-xl bg-black/60 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#3af1f7] transition-all ${
                        isCalendarLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                      }`}
                    >
                      {!isCalendarLocked && <option value="">Select a calendar...</option>}
                      {isCalendarLocked ? (
                        <option value={existingCalendar}>{existingCalendar}</option>
                      ) : (
                        acuityCalendars.map((cal) => (
                          <option key={cal.id} value={cal.name}>
                            {cal.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  {!isCalendarLocked && (
                    <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-3">
                      <p className="text-xs text-rose-200 font-semibold">
                        ⚠️ WARNING: You cannot change your calendar after clicking Next.
                      </p>
                      <p className="text-xs text-rose-200 mt-1">
                        Make sure you select the correct calendar before proceeding.
                      </p>
                    </div>
                  )}
                </div>
              )}
              {providerConnected && (
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs text-emerald-300 border border-emerald-300/30 rounded-full px-3 py-1 w-fit">
                    {selectedProvider === 'acuity' ? 'Acuity account connected' : 'Square connected'}
                  </span>
                  {selectedProvider === 'acuity' && (
                    <span className={`text-xs border rounded-full px-3 py-1 w-fit ${
                      selectedAcuityCalendar 
                        ? 'text-emerald-300 border-emerald-300/30' 
                        : 'text-amber-300 border-amber-300/30'
                    }`}>
                      {selectedAcuityCalendar ? `Calendar selected: ${selectedAcuityCalendar}` : 'Calendar not selected'}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Back and Next Buttons */}
        <div className="flex justify-between items-center gap-4 pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={onBack}
            disabled={saving}
            className={`px-6 py-3 font-semibold rounded-xl transition-all ${
              saving
                ? 'bg-white/5 border border-white/10 text-gray-400 cursor-not-allowed'
                : 'bg-white/10 border border-white/20 hover:bg-white/15'
            }`}
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={profileLoading || saving || !isCalendarConnected || !isCalendarSelected}
            className={`px-8 py-3 font-semibold rounded-xl transition-all ${
              profileLoading || saving || !isCalendarConnected || !isCalendarSelected
                ? 'bg-white/5 border border-white/10 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-[#7affc9] to-[#3af1f7] text-black hover:shadow-lg'
            }`}
          >
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </span>
            ) : (
              'Next'
            )}
          </button>
        </div>
        
        {!isCalendarConnected && (
          <p className="text-xs text-gray-400 text-center">
            Connect a calendar to continue
          </p>
        )}
        {isCalendarConnected && !isCalendarSelected && !isCalendarLocked && (
          <p className="text-xs text-gray-400 text-center">
            Select a calendar to continue
          </p>
        )}
      </div>
    </div>
  )
}