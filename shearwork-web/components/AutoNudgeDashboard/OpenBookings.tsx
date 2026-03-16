'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'

interface Props {
  user_id: string
}

export default function OpenBookings({ user_id }: Props) {
  const [totalOpenings, setTotalOpenings] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const refreshTimeoutRef = useRef<number | null>(null)

  const fetchOpenings = useCallback(async (
    showErrorToast: boolean = false,
    forceFresh: boolean = false
  ) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const endpoint = forceFresh
        ? '/api/acuity/open-bookings?fresh=true'
        : '/api/acuity/open-bookings'

      const response = await fetch(endpoint, {
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
          void fetchOpenings(false, true)
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

  const desktopRing = (
    <div className="relative flex items-center justify-center flex-shrink-0">
      <svg width="96" height="96" className="-rotate-90">
        <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <circle cx="48" cy="48" r="40" fill="none" stroke="#a3e635" strokeWidth="8"
          strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 40}`} strokeDashoffset={0}
          className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-white leading-none">{totalOpenings}</span>
        <span className="text-[10px] text-white/30 mt-0.5">slots</span>
      </div>
    </div>
  )

  const mobileRing = (
    <div className="relative flex-shrink-0" style={{ width: 64, height: 64 }}>
      <svg viewBox="0 0 64 64" width="64" height="64" className="-rotate-90">
        <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle cx="32" cy="32" r="28" fill="none" stroke="#a3e635" strokeWidth="6"
          strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 28}`} strokeDashoffset={0}
          className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-black text-white leading-none">{totalOpenings}</span>
        <span className="text-[8px] text-white/30 mt-0.5">slots</span>
      </div>
    </div>
  )

  return (
    <div className="relative h-full w-full overflow-hidden
      flex flex-col p-3
      md:flex-row md:items-center md:justify-between md:px-2 md:py-0
    ">
      <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-lime-400/8 blur-3xl pointer-events-none" />

      {/* Mobile label — fixed height, no subtitle */}
      <div className="flex flex-col md:hidden" style={{ height: 46 }}>
        <p className="text-white/40 uppercase font-medium tracking-widest text-[9px]">This Week</p>
        <p className="text-white font-black leading-tight mt-0.5 text-sm">Open Bookings</p>
      </div>

      {/* Desktop label */}
      <div className="hidden md:flex flex-col justify-center">
        <p className="text-white/40 uppercase font-medium tracking-widest text-xs">This Week</p>
        <p className="text-white font-black text-2xl leading-tight mt-1">Open Bookings</p>
        <p className="text-white/30 text-xs mt-1">Available slots in your schedule</p>
      </div>

      {/* Mobile ring */}
      <div className="md:hidden mt-auto">
        {loading
          ? <div className="w-8 h-8 rounded-full border-2 border-lime-400/30 border-t-lime-400 animate-spin" />
          : mobileRing}
      </div>

      {/* Desktop ring */}
      <div className="hidden md:block">
        {loading
          ? <div className="w-16 h-16 rounded-full border-2 border-lime-400/30 border-t-lime-400 animate-spin flex-shrink-0" />
          : desktopRing}
      </div>
    </div>
  )
}
