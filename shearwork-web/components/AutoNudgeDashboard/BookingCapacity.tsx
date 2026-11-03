'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'
import { Gauge } from 'lucide-react'

interface Props {
  user_id: string
}

export default function BookingCapacity({ user_id }: Props) {
  const [capacity, setCapacity] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const refreshTimeoutRef = useRef<number | null>(null)

  const fetchCapacity = async (showErrorToast: boolean = false) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch('/api/acuity/booking-rate', {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
      })

      if (!response.ok) {
        if (showErrorToast) {
          toast.error('Failed to load booking data')
        }
        setCapacity(null)
        return
      }

      const { totalBooked, totalOpen } = await response.json()
      const total = totalBooked + totalOpen
      if (total === 0) {
        setCapacity(null)
        return
      }

      setCapacity(Math.round((totalBooked / total) * 100))
    } catch (error) {
      console.error('Error loading booking capacity:', error)
      if (showErrorToast) {
        toast.error('Failed to load booking data')
      }
      setCapacity(null)
    }
  }

  useEffect(() => {
    const init = async () => {
      await fetchCapacity(true)
      setLoading(false)
    }
    init()
  }, [user_id])

  useEffect(() => {
    const channel = supabase
      .channel('booking-capacity-realtime')
      .on('postgres_changes', {
        event: '*', schema: 'public',
        table: 'availability_daily_summary',
        filter: `user_id=eq.${user_id}`,
      }, () => {
        if (refreshTimeoutRef.current) {
          window.clearTimeout(refreshTimeoutRef.current)
        }

        refreshTimeoutRef.current = window.setTimeout(() => {
          void fetchCapacity()
        }, 400)
      })
      .subscribe()

    return () => {
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current)
      }
      supabase.removeChannel(channel)
    }
  }, [user_id])

  const circumference = 2 * Math.PI * 42

  return (
    <div data-tone="sand" className="stat-root tone-sand flex h-full w-full flex-col justify-between gap-2 overflow-hidden p-3 md:flex-row md:items-center md:gap-4 md:p-5">
      <div className="min-w-0">
        <p className="stat-label">Booking rate</p>
        <p className="stat-value mt-1.5 text-lg md:mt-2 md:text-[1.75rem]">
          {loading ? '\u2014' : capacity === null ? <span className="text-gray-500">&ndash;</span> : `${capacity}%`}
        </p>
        <p className="mt-1.5 text-[11px] leading-snug text-gray-500 md:text-xs">
          {!loading && capacity === null ? 'No data yet' : (
            <>
              <span className="md:hidden">Filled</span>
              <span className="hidden md:inline">Of this week&apos;s slots filled</span>
            </>
          )}
        </p>
      </div>

      <div className="relative hidden h-12 w-12 flex-shrink-0 md:block md:h-20 md:w-20">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
          {!loading && capacity !== null && capacity > 0 && (
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgb(255 181 71)" strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={`${circumference * (1 - capacity / 100)}`}
              className="transition-all duration-700" />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Gauge
            className={`h-4 w-4 md:h-5 md:w-5 ${capacity === null ? 'text-gray-600' : 'text-sage'}`}
            strokeWidth={1.75}
          />
        </div>
      </div>
    </div>
  )
}
