'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'
import { CalendarDays } from 'lucide-react'

interface Props {
  user_id: string
}

export default function OpenBookings({ user_id }: Props) {
  const [totalOpenings, setTotalOpenings] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const refreshTimeoutRef = useRef<number | null>(null)

  const fetchOpenings = useCallback(async (showErrorToast: boolean = false) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch('/api/acuity/open-bookings', {
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      })

      if (!response.ok) {
        if (showErrorToast) {
          toast.error('Failed to load open bookings')
        }
        setTotalOpenings(0)
        return
      }

      const payload = await response.json()
      setTotalOpenings(Number(payload.totalOpenings ?? 0))
    } catch (error) {
      console.error('Error fetching open bookings:', error)
      if (showErrorToast) {
        toast.error('Failed to load open bookings')
      }
      setTotalOpenings(0)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      await fetchOpenings(true)
      setLoading(false)
    }

    init()
  }, [fetchOpenings])

  useEffect(() => {
    const channel = supabase
      .channel('open-bookings-realtime')
      .on('postgres_changes', {
        event: '*', schema: 'public',
        table: 'availability_daily_summary',
        filter: `user_id=eq.${user_id}`,
      }, () => {
        if (refreshTimeoutRef.current) {
          window.clearTimeout(refreshTimeoutRef.current)
        }

        refreshTimeoutRef.current = window.setTimeout(() => {
          void fetchOpenings()
        }, 400)
      })
      .subscribe()

    return () => {
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current)
      }
      supabase.removeChannel(channel)
    }
  }, [fetchOpenings, user_id])

  return (
    <div data-tone="sky" className="stat-root tone-sky flex h-full w-full flex-col justify-between gap-2 overflow-hidden p-3 md:flex-row md:items-center md:gap-4 md:p-5">
      <div className="min-w-0">
        <p className="stat-label">Open bookings</p>
        <p className="stat-value mt-1.5 text-lg md:mt-2 md:text-[1.75rem]">
          {loading ? '\u2014' : totalOpenings}
        </p>
        <p className="mt-1.5 text-[11px] leading-snug text-gray-500 md:text-xs">
          <span className="md:hidden">Slots this week</span>
          <span className="hidden md:inline">Available slots in your schedule this week</span>
        </p>
      </div>

      <div className="relative hidden h-12 w-12 flex-shrink-0 md:block md:h-20 md:w-20">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
          {!loading && (
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgb(112 166 222)" strokeWidth="8"
              strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 42}`} strokeDashoffset={0}
              className="transition-all duration-700" />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <CalendarDays className="h-4 w-4 text-tone md:h-5 md:w-5" strokeWidth={1.75} />
        </div>
      </div>
    </div>
  )
}
