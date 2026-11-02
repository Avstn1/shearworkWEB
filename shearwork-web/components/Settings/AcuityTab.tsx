'use client'

import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/utils/supabaseClient'
import ConnectAcuityButton from '../ConnectAcuityButton'
import Select from '@/components/UI/Select'
import { Calendar, RefreshCw, Database, Loader2, AlertTriangle } from 'lucide-react'
import { Panel } from '@/components/ui/AppKit'

interface CalendarItem {
  id: number | string
  name: string
  [k: string]: any
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export default function AcuityTab() {
  const [profile, setProfile] = useState<any>(null)
  const [calendars, setCalendars] = useState<CalendarItem[]>([])
  const [selectedCalendar, setSelectedCalendar] = useState<string>('')
  const [acuityConnected, setAcuityConnected] = useState(false)
  const [squareConnected, setSquareConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [syncingClients, setSyncingClients] = useState(false)
  const [syncingAppointments, setSyncingAppointments] = useState(false)
  const hasCalendarChange = selectedCalendar !== (profile?.calendar ?? '')
  const calendarLocked = Boolean(profile?.calendar) // Locked if calendar already selected

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      setProfile(profileData)
      setSelectedCalendar(profileData?.calendar || '')

      const statusRes = await fetch('/api/acuity/status', { cache: 'no-store' })
      const statusData = statusRes.ok ? await statusRes.json() : null
      const connected = Boolean(statusData?.connected)
      setAcuityConnected(connected)

      if (connected) {
        const res = await fetch('/api/acuity/calendar')
        if (!res.ok)
          console.log('Failed to fetch calendars.')
          // throw new Error((await res.json()).error || 'Failed to fetch calendars')
        const data = await res.json()
        setCalendars(data.calendars || [])
      } else {
        setCalendars([])
      }

      const squareRes = await fetch('/api/square/status', { cache: 'no-store' })
      const squareData = squareRes.ok ? await squareRes.json() : null
      setSquareConnected(Boolean(squareData?.connected))
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const saveCalendar = async (value?: string) => {
    if (!profile) return
    const newCal = value ?? selectedCalendar
    if (!newCal) return toast.error('Please choose a calendar')

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Not logged in')

      const { error } = await supabase
        .from('profiles')
        .update({ calendar: newCal })
        .eq('user_id', user.id)

      if (error) throw error

      toast.success('Calendar saved!')
      loadData()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to save calendar')
    }
  }

  const handleCalendarChangeRequest = (val: string) => {
    if (calendarLocked) {
      toast.error('Calendar is locked after first selection')
      return
    }
    setSelectedCalendar(val)
  }

  const handleBeforeConnect = async () => {
    if (!squareConnected) return true
    const toastId = toast.loading('Disconnecting Square...')
    const res = await fetch('/api/square/disconnect', { method: 'POST' })
    if (!res.ok) {
      toast.error('Failed to disconnect Square', { id: toastId })
      return false
    }
    toast.success('Square disconnected', { id: toastId })
    setSquareConnected(false)
    return true
  }

  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 4 }, (_, i) => {
      const y = (currentYear - i).toString()
      return { value: y, label: y }
    })
  }

  /**
   * ✅ Migrated: Uses new pipeline endpoint /api/pull
   * This will trigger the orchestrated sync + aggregations for each month.
   */
  const syncYear = async () => {
    if (!profile) return

    setSyncingClients(true)
    const toastId = toast.loading(`Syncing ${year}...`)

    try {
      for (const month of MONTHS) {
        const res = await fetch(
          `/api/pull?granularity=month&month=${encodeURIComponent(month)}&year=${encodeURIComponent(year)}`,
          { method: 'GET' }
        )

        const body = await res.json().catch(() => ({}))

        if (!res.ok) {
          throw new Error(body.error || `Sync failed for ${month} ${year}`)
        }
      }

      toast.success(`Synced data for all of ${year}`, { id: toastId })
    } catch (err: any) {
      console.error(err)
      toast.error(`Failed to sync ${year}: ${err.message || 'Unknown error'}`, {
        id: toastId,
      })
    } finally {
      setSyncingClients(false)
    }
  }

  /**
   * Leaving as-is: this queues a background sync via Supabase function.
   * If that function calls /api/acuity/pull internally, update it separately.
   */
  const syncFullYear = async () => {
    if (!profile) return

    const confirmAction = window.confirm(
      `This will sync all appointments for ${year}. Continue?`
    )
    if (!confirmAction) return

    setSyncingAppointments(true)
    const toastId = toast.loading(`Syncing appointments for ${year}...`)

    try {
      const { data, error } = await supabase.functions.invoke(
        'fullyear_sync_barbers',
        {
          body: {
            user_id: profile.user_id,
            year: year
          }
        }
      )

      if (error) {
        throw new Error(error.message || 'Full Acuity sync failed')
      }

      toast.success(
        `Successfully queued sync for ${year}! It will process in the background.`,
        { id: toastId }
      )
    } catch (err: any) {
      console.error(err)
      toast.error(`Failed to queue sync for ${year}`, { id: toastId })
    } finally {
      setSyncingAppointments(false)
    }
  }

  if (loading)
    return (
      <div className="panel flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-sage" strokeWidth={1.75} />
      </div>
    )

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Connection */}
      <Panel
        title="Acuity integration"
        subtitle="Connect and sync your Acuity Scheduling data"
        actions={
          acuityConnected
            ? <span className="badge badge-sage">Connected</span>
            : <span className="badge">Not connected</span>
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 text-[13px]">
            {squareConnected && (
              <p className="text-amber-300">
                Connecting Acuity will disconnect Square to keep one active provider.
              </p>
            )}
            {!acuityConnected && (
              <p className="text-muted">Connect Acuity to load your calendars.</p>
            )}
            {acuityConnected && !squareConnected && (
              <p className="text-muted">Your Acuity account is linked to Corva.</p>
            )}
          </div>
          <div className="flex shrink-0 justify-end">
            <ConnectAcuityButton onConnectSuccess={loadData} onBeforeConnect={handleBeforeConnect} />
          </div>
        </div>
      </Panel>

      {/* Calendar Selection */}
      <Panel
        title={
          <span className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" strokeWidth={1.75} />
            Calendar
          </span>
        }
      >
        {calendarLocked ? (
          // Calendar is locked - show read-only display
          <div className="space-y-3">
            <div>
              <p className="field-label">Active calendar</p>
              <p className="text-[15px] font-semibold text-ivory">{profile.calendar}</p>
            </div>
            <p className="text-[13px] text-muted">
              Calendar is locked after selection. Contact support if you need to switch calendars.
            </p>
          </div>
        ) : (
          // Calendar not yet selected - allow selection
          <div className="space-y-4">
            <div>
              <label className="field-label">Calendar</label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex-1">
                  <Select
                    options={[
                      { value: '', label: 'Select calendar' },
                      ...calendars.map((c) => ({ value: c.name, label: c.name })),
                    ]}
                    value={selectedCalendar}
                    onChange={(val) => handleCalendarChangeRequest(val as string)}
                    disabled={!acuityConnected || calendars.length === 0}
                  />
                </div>

                {hasCalendarChange && selectedCalendar && (
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setSelectedCalendar(profile?.calendar || '')
                      }}
                      className="btn btn-ghost btn-sm h-10"
                    >
                      Cancel
                    </button>
                    <button onClick={() => saveCalendar(selectedCalendar)} className="btn btn-primary btn-sm h-10">
                      Save
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2.5 rounded-lg border border-amber-300/20 bg-amber-300/[0.06] p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" strokeWidth={1.75} />
              <div className="text-[13px]">
                <p className="font-semibold text-amber-300">You cannot change your calendar after selecting one.</p>
                <p className="mt-0.5 text-muted">
                  If you need to change calendars later, you will need to create a new account.
                </p>
              </div>
            </div>
          </div>
        )}
      </Panel>

      {/* Sync Section */}
      <Panel
        title={
          <span className="flex items-center gap-2">
            <Database className="h-4 w-4 text-gray-500" strokeWidth={1.75} />
            Sync & import
          </span>
        }
        subtitle="Sync all appointments for comprehensive revenue reports."
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full sm:w-36">
            <label className="field-label">Year</label>
            <Select
              options={generateYearOptions()}
              value={year}
              onChange={(val) => setYear(val as string)}
            />
          </div>

          <button
            onClick={syncYear}
            disabled={syncingAppointments}
            className={`btn btn-primary btn-sm h-10 self-end ${syncingClients ? 'opacity-50' : ''}`}
          >
            <RefreshCw
              className={`h-4 w-4 ${syncingAppointments ? 'animate-spin' : ''}`}
              strokeWidth={1.75}
            />
            {syncingAppointments ? `Syncing ${year}...` : `Sync All Appointments`}
          </button>
        </div>

        <p className="mt-4 text-xs text-gray-500">
          Sync clients to update customer data and appointment history. Sync all
          appointments for comprehensive revenue reports.
        </p>
      </Panel>
    </div>
  )
}
