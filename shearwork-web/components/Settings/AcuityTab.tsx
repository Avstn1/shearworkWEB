'use client'

import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/utils/supabaseClient'
import ConnectAcuityButton from '../ConnectAcuityButton'
import Select from '@/components/UI/Select'
import { Calendar, RefreshCw, Database } from 'lucide-react'

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
  const [isEditingCalendar, setIsEditingCalendar] = useState(false)
  const [confirmingChange, setConfirmingChange] = useState(false)
  const [loading, setLoading] = useState(false)
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [syncingClients, setSyncingClients] = useState(false)
  const [syncingAppointments, setSyncingAppointments] = useState(false)

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

      const res = await fetch('/api/acuity/calendar')
      if (!res.ok)
        throw new Error((await res.json()).error || 'Failed to fetch calendars')
      const data = await res.json()
      setCalendars(data.calendars || [])
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

      toast.success('Calendar updated!')
      setIsEditingCalendar(false)
      setConfirmingChange(false)
      loadData()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to update calendar')
    }
  }

  const handleCalendarChangeRequest = (val: string) => {
    if (profile?.calendar && profile.calendar !== val) {
      setSelectedCalendar(val)
      setConfirmingChange(true)
    } else {
      setSelectedCalendar(val)
    }
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
        `fullyear_sync_barbers?user_id=${encodeURIComponent(profile.user_id)}`
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
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-lime-400"></div>
      </div>
    )

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-2">Acuity Integration</h2>
        <p className="text-sm text-gray-400">
          Connect and sync your Acuity Scheduling data
        </p>
      </div>

      <ConnectAcuityButton onConnectSuccess={loadData} />

      {/* Calendar Selection */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Calendar
        </h3>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Select
              options={[
                { value: '', label: 'Select calendar' },
                ...calendars.map((c) => ({ value: c.name, label: c.name })),
              ]}
              value={selectedCalendar}
              onChange={(val) => handleCalendarChangeRequest(val as string)}
              disabled={!isEditingCalendar}
            />
          </div>

          {!isEditingCalendar ? (
            <button
              onClick={() => setIsEditingCalendar(true)}
              className="px-6 py-3 bg-white/10 border border-white/20 rounded-xl hover:bg-white/15 transition-all font-medium whitespace-nowrap"
            >
              Change
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSelectedCalendar(profile?.calendar || '')
                  setIsEditingCalendar(false)
                  setConfirmingChange(false)
                }}
                className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl hover:bg-white/15 transition-all font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => saveCalendar(selectedCalendar)}
                className="px-6 py-3 bg-gradient-to-r from-lime-400 to-emerald-400 text-black font-semibold rounded-xl hover:shadow-lg hover:shadow-lime-400/20 transition-all"
              >
                Save
              </button>
            </div>
          )}
        </div>

        {confirmingChange && (
          <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-3">
            <p className="text-sm text-amber-200">
              Changing your calendar will sync all data for this calendar.
              Confirm if you want to continue.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setConfirmingChange(false)
                  setIsEditingCalendar(false)
                  setSelectedCalendar(profile?.calendar || '')
                }}
                className="px-4 py-2 bg-white/10 border border-white/20 rounded-xl hover:bg-white/15 transition-all font-medium"
              >
                Cancel
              </button>

              <button
                onClick={() => saveCalendar(selectedCalendar)}
                className="px-6 py-2 bg-gradient-to-r from-lime-400 to-emerald-400 text-black font-semibold rounded-xl hover:shadow-lg transition-all"
              >
                Confirm Change
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sync Section */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Database className="w-5 h-5" />
          Sync & Import
        </h3>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="w-full sm:w-32">
              <Select
                options={generateYearOptions()}
                value={year}
                onChange={(val) => setYear(val as string)}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <button
                onClick={syncFullYear}
                disabled={syncingAppointments}
                className={`px-6 py-3 rounded-xl font-semibold transition-all whitespace-nowrap flex items-center justify-center gap-2 ${
                  syncingClients
                    ? 'bg-white/10 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-lime-400 to-emerald-400 text-black hover:shadow-lg hover:shadow-lime-400/20'
                }`}
              >
                <RefreshCw
                  className={`w-4 h-4 ${syncingAppointments ? 'animate-spin' : ''}`}
                />
                {syncingAppointments ? `Syncing ${year}...` : `Sync All Appointments`}
              </button>

              {/* <button
                onClick={syncYear}
                disabled={syncingClients}
                className={`px-6 py-3 rounded-xl font-semibold transition-all whitespace-nowrap flex items-center justify-center gap-2 ${
                  syncingClients
                    ? 'bg-white/10 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-lime-400 to-emerald-400 text-black hover:shadow-lg hover:shadow-lime-400/20'
                }`}
              >
                <RefreshCw
                  className={`w-4 h-4 ${syncingClients ? 'animate-spin' : ''}`}
                />
                {syncingClients ? `Syncing ${year}...` : `Sync Clients`}
              </button> */}
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Sync clients to update customer data and appointment history. Sync all
            appointments for comprehensive revenue reports.
          </p>
        </div>
      </div>
    </div>
  )
}
