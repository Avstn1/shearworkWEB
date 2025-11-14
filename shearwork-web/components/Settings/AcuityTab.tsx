'use client'

import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/utils/supabaseClient'
import ConnectAcuityButton from '../ConnectAcuityButton'
import Select from '@/components/UI/Select'

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

interface CalendarItem {
  id: number | string
  name: string
  [k: string]: any
}

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

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      setProfile(profileData)
      setSelectedCalendar(profileData?.calendar || '')

      const res = await fetch('/api/acuity/calendar')
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to fetch calendars')
      const data = await res.json()
      setCalendars(data.calendars || [])
    } catch (err: any) {
    //   console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const saveCalendar = async (value?: string) => {
    if (!profile) return
    const newCal = value ?? selectedCalendar
    if (!newCal) return toast.error('Please choose a calendar')
    try {
      const { data: { user } } = await supabase.auth.getUser()
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

  // ----- Sync Clients -----
  const syncYear = async () => {
    if (!profile) return
    setSyncingClients(true)
    const toastId = toast.loading(`Syncing clients for ${year}...`)
    try {
      const res = await fetch(`/api/acuity/pull-clients?year=${encodeURIComponent(year)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Client sync failed')
      toast.success(`✅ Synced ${data.totalClients} clients for ${year}!`, { id: toastId })
    } catch (err: any) {
      console.error(err)
      toast.error(`❌ Failed to sync clients for ${year}`, { id: toastId })
    } finally {
      setSyncingClients(false)
    }
  }

  // ----- Sync Full Year Appointments -----
  const syncFullYear = async () => {
    if (!profile) return
    const confirmAction = window.confirm(`This will sync all appointments for ${year}. Continue?`)
    if (!confirmAction) return

    setSyncingAppointments(true)
    const toastId = toast.loading(`Syncing appointments for ${year}...`)
    try {
      for (const month of MONTHS) {
        try {
          const res = await fetch(`/api/acuity/pull?endpoint=appointments&month=${encodeURIComponent(month)}&year=${encodeURIComponent(year)}`)
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || `Failed to fetch ${month}`)
        } catch (err: any) {
          console.error(`Error syncing ${month}:`, err)
        }
      }
      toast.success(`✅ Successfully synced all appointments for ${year}!`, { id: toastId })
    } catch (err: any) {
      console.error(err)
      toast.error(`❌ Failed to sync appointments for ${year}`, { id: toastId })
    } finally {
      setSyncingAppointments(false)
    }
  }

  if (loading) return <p className="text-white">Loading Acuity data...</p>

  // --- FUTURISTIC BUTTON CLASSES ---
  const primaryBtn = 'px-4 py-2 bg-gradient-to-r from-[#7affc9] to-[#3af1f7] text-black font-semibold rounded-xl hover:shadow-[0_0_15px_#3af1f7] transition-all'
  const secondaryBtn = 'px-4 py-2 bg-white/10 border border-[var(--accent-2)] rounded-xl hover:bg-white/20 transition-all'
  const smallPrimaryBtn = 'px-3 py-2 bg-gradient-to-r from-[#7affc9] to-[#3af1f7] text-black font-semibold rounded-xl hover:shadow-[0_0_12px_#3af1f7] transition-all'
  const smallSecondaryBtn = 'px-3 py-2 bg-white/10 border border-[var(--accent-2)] rounded-xl hover:bg-white/20 transition-all'

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-bold">Acuity Integration</h2>

      <ConnectAcuityButton onConnectSuccess={loadData} />

      {/* Calendar Selection */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Calendar</h3>
        <div className="flex gap-2 items-center">
          <Select
            options={[{ value: '', label: 'Select calendar' }, ...calendars.map(c => ({ value: c.name, label: c.name }))]}
            value={selectedCalendar}
            onChange={(val) => handleCalendarChangeRequest(val as string)}
            disabled={!isEditingCalendar}
          />
          {!isEditingCalendar ? (
            <button onClick={() => setIsEditingCalendar(true)} className={secondaryBtn}>Change</button>
          ) : (
            <>
              <button
                onClick={() => {
                  setSelectedCalendar(profile?.calendar || '')
                  setIsEditingCalendar(false)
                  setConfirmingChange(false)
                }}
                className={secondaryBtn}
              >Cancel</button>
              <button
                onClick={() => saveCalendar(selectedCalendar)}
                className={primaryBtn}
              >Save</button>
            </>
          )}
        </div>

        {confirmingChange && (
          <div className="mt-3 bg-white/5 border border-[var(--accent-2)] rounded-lg p-3">
            <p className="text-sm">Changing your calendar will sync all data for this calendar. Confirm if you want to continue.</p>
            <div className="mt-3 flex gap-3">
              <button
                onClick={() => {
                  setConfirmingChange(false)
                  setIsEditingCalendar(false)
                  setSelectedCalendar(profile?.calendar || '')
                }}
                className={smallSecondaryBtn}
              >Cancel</button>
              <button
                onClick={() => saveCalendar(selectedCalendar)}
                className={smallPrimaryBtn}
              >Confirm</button>
            </div>
          </div>
        )}
      </section>

      {/* Sync Section */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Sync & Import</h3>
        <div className="flex gap-4 flex-wrap items-center">
          <Select
            options={generateYearOptions()}
            value={year}
            onChange={(val) => setYear(val as string)}
          />

          <button
            onClick={syncYear}
            disabled={syncingClients}
            className={`${syncingClients ? 'bg-white/20 text-white cursor-not-allowed' : primaryBtn}`}
          >
            {syncingClients ? `Syncing clients ${year}...` : `Sync Clients`}
          </button>

          <button
            onClick={syncFullYear}
            disabled={syncingAppointments}
            className={`${syncingAppointments ? 'bg-white/20 text-white cursor-not-allowed' : secondaryBtn}`}
          >
            {syncingAppointments ? `Syncing appointments ${year}...` : `Sync All Appointments`}
          </button>
        </div>
      </section>
    </div>
  )
}
