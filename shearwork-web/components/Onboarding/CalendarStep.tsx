'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, Check, Loader2 } from 'lucide-react'
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

  const continueDisabled = profileLoading || saving || !isCalendarConnected || !isCalendarSelected

  return (
    <section className="panel">
      <header className="panel-header">
        <div className="min-w-0">
          <h2 className="panel-title">Connect your calendar</h2>
          <p className="panel-subtitle">
            Choose the provider you want to sync. You can change this later in Settings.
          </p>
        </div>
      </header>

      <div className="panel-body space-y-5">
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Calendar provider">
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
          ).map((option) => {
            const isSelected = selectedProvider === option.id
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelectedProvider(option.id)}
                className={`w-full rounded-lg border p-4 text-left transition-colors ${
                  isSelected
                    ? 'border-sage/45 bg-sage/[0.06]'
                    : 'border-white/[0.07] bg-canvas hover:border-white/[0.12]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                      isSelected ? 'border-sage' : 'border-white/25'
                    }`}
                  >
                    {isSelected && <span className="h-2 w-2 rounded-full bg-sage" />}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-ivory">{option.title}</p>
                      {option.id === 'acuity' && <span className="badge badge-sage">Recommended</span>}
                    </div>
                    <p className="mt-0.5 text-[13px] text-gray-400">{option.description}</p>
                    <p className="mt-1 text-xs text-gray-500">{option.helper}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {selectedProvider && (
          <div className="rounded-lg border border-white/[0.07] bg-raised p-4">
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-sm font-semibold text-ivory">
                  {selectedProvider === 'acuity' ? 'Acuity selected' : 'Square selected'}
                </p>
                <p className="text-[13px] text-gray-400">
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
                    <label className="field-label">Select calendar</label>
                    <select
                      value={isCalendarLocked ? existingCalendar : selectedAcuityCalendar}
                      onChange={e => setSelectedAcuityCalendar(e.target.value)}
                      disabled={isCalendarLocked}
                      className={`field ${
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
                    <div className="flex gap-2.5 rounded-lg border border-[#FF8F7D]/25 bg-[#FF8F7D]/[0.06] px-3 py-2.5">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FF8F7D]" strokeWidth={1.75} />
                      <div>
                        <p className="text-xs font-semibold text-[#FF8F7D]">
                          You cannot change your calendar after clicking Continue.
                        </p>
                        <p className="mt-0.5 text-xs text-gray-400">
                          Make sure you select the correct calendar before proceeding.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {providerConnected && (
                <div className="flex flex-wrap gap-2">
                  <span className="badge badge-sage">
                    <Check className="h-3 w-3" strokeWidth={2} />
                    {selectedProvider === 'acuity' ? 'Acuity account connected' : 'Square connected'}
                  </span>
                  {selectedProvider === 'acuity' && (
                    <span className={`badge ${selectedAcuityCalendar ? 'badge-sage' : 'badge-warn'}`}>
                      {selectedAcuityCalendar ? `Calendar selected: ${selectedAcuityCalendar}` : 'Calendar not selected'}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Back and Continue */}
      <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] px-5 py-4">
        <button
          type="button"
          onClick={onBack}
          disabled={saving}
          className="btn btn-ghost"
        >
          Back
        </button>
        <div className="flex items-center gap-3">
          {!isCalendarConnected && (
            <p className="hidden text-xs text-gray-500 sm:block">Connect a calendar to continue</p>
          )}
          {isCalendarConnected && !isCalendarSelected && !isCalendarLocked && (
            <p className="hidden text-xs text-gray-500 sm:block">Select a calendar to continue</p>
          )}
          <button
            type="button"
            onClick={handleNext}
            disabled={continueDisabled}
            className="btn btn-primary min-w-[120px]"
          >
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </span>
            ) : (
              'Continue'
            )}
          </button>
        </div>
      </div>
    </section>
  )
}
