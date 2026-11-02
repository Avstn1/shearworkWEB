'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'

interface Props {
  user_id: string
}

/**
 * ISO 8601 week number — matches the server-side getISOWeek() used in
 * update_sms_barber_success.ts and client_sms_from_barber_nudge/index.ts.
 *
 * Uses the nearest-Thursday rule:
 *   1. Find the Thursday in the same ISO week as `date`.
 *   2. That Thursday's year owns the week.
 *   3. Week 1 starts on the Monday of the week that contains Jan 4.
 */
const getCurrentISOWeek = (): string => {
  // Produce a Date whose UTC values represent Toronto local calendar date.
  // This keeps us aligned with the server's Intl.DateTimeFormat('en-CA', Toronto) approach.
  const torontoStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

  // torontoStr is "YYYY-MM-DD" — parse as local-midnight
  const now = new Date(torontoStr)

  // Day of week: ISO convention Mon=1 … Sun=7
  const day = now.getDay() || 7
  // Shift to Thursday of this ISO week
  now.setDate(now.getDate() + 4 - day)

  const yearStart = new Date(now.getFullYear(), 0, 1)
  const weekNumber = Math.ceil(((+now - +yearStart) / 86400000 + 1) / 7)

  return `${now.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`
}

export default function AutoNudgeImpact({ user_id }: Props) {
  const [bookingsRecovered, setBookingsRecovered] = useState<number | null>(null)
  const [revenueRecovered, setRevenueRecovered] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchImpact = async () => {
    const isoWeek = getCurrentISOWeek()
    const { data, error } = await supabase
      .from('barber_nudge_success')
      .select('client_ids, prices')
      .eq('user_id', user_id)
      .eq('iso_week_number', isoWeek)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching nudge impact:', error)
      toast.error('Failed to load AutoNudge impact')
      setBookingsRecovered(0); setRevenueRecovered(0); return
    }
    if (!data) { setBookingsRecovered(0); setRevenueRecovered(0); return }
    setBookingsRecovered(data.client_ids?.length ?? 0)
    setRevenueRecovered(data.prices?.reduce((sum: number, p: number | string) => sum + Number(p), 0) ?? 0)
  }

  useEffect(() => {
    const init = async () => { await fetchImpact(); setLoading(false) }
    init()
  }, [user_id])

  useEffect(() => {
    const channel = supabase
      .channel('autonudge-impact-realtime')
      .on('postgres_changes', {
        event: '*', schema: 'public',
        table: 'barber_nudge_success',
        filter: `user_id=eq.${user_id}`,
      }, () => { fetchImpact() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user_id])

  return (
    <div className="flex h-full w-full flex-row items-center justify-between gap-4 overflow-hidden p-3 md:flex-col md:items-stretch md:justify-between md:p-5">
      <div className="min-w-0">
        <p className="stat-label">Corva&apos;s impact</p>
        <p className="mt-1.5 text-[11px] leading-snug text-gray-500 md:text-xs">Recovered this week</p>
      </div>

      <div className="flex items-end gap-5 md:gap-6">
        <div className="min-w-0">
          <p className="stat-value text-xl md:text-[1.75rem]">
            {loading ? '\u2014' : bookingsRecovered}
          </p>
          <p className="mt-1 text-[11px] text-gray-500 md:text-xs">Bookings</p>
        </div>
        <div className="h-9 w-px self-center bg-white/[0.07]" />
        <div className="min-w-0">
          <p className="stat-value text-xl md:text-[1.75rem]">
            {loading ? '\u2014' : `$${(revenueRecovered ?? 0).toLocaleString()}`}
          </p>
          <p className="mt-1 text-[11px] text-gray-500 md:text-xs">Revenue</p>
        </div>
      </div>
    </div>
  )
}
