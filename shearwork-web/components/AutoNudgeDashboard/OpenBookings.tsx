'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'

interface Props {
  user_id: string
}

export default function OpenBookings({ user_id }: Props) {
  const [totalOpenings, setTotalOpenings] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const getWeekRange = () => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const start = new Date(now)
    start.setDate(now.getDate() + diff)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    }
  }

  const fetchOpenings = async () => {
    const { start, end } = getWeekRange()
    const { data, error } = await supabase
      .from('availability_daily_summary')
      .select('slot_count_update')
      .eq('user_id', user_id)
      .gte('slot_date', start)
      .lte('slot_date', end)

    if (error) {
      console.error('Error fetching availability:', error)
      toast.error('Failed to load open bookings')
      setTotalOpenings(0)
      return
    }
    const total = data?.reduce((sum, row) => sum + (row.slot_count_update || 0), 0) ?? 0
    setTotalOpenings(total)
  }

  useEffect(() => {
    const init = async () => { await fetchOpenings(); setLoading(false) }
    init()
  }, [user_id])

  useEffect(() => {
    const channel = supabase
      .channel('open-bookings-realtime')
      .on('postgres_changes', {
        event: '*', schema: 'public',
        table: 'availability_daily_summary',
        filter: `user_id=eq.${user_id}`,
      }, () => { fetchOpenings() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user_id])

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
      flex flex-col justify-between p-3
      md:flex-row md:items-center md:justify-between md:px-2 md:py-0
    ">
      <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-lime-400/8 blur-3xl pointer-events-none" />

      {/* Label */}
      <div className="flex flex-col justify-center">
        <p className="text-white/40 uppercase font-medium tracking-widest text-[9px] md:text-xs">This Week</p>
        <p className="text-white font-black leading-tight mt-0.5 text-sm md:hidden">Open</p>
        <p className="text-white font-black leading-tight text-sm md:hidden">Bookings</p>
        <p className="hidden md:block text-white font-black text-2xl leading-tight mt-1">Open Bookings</p>
        <p className="text-white/30 leading-tight mt-1 text-[9px] md:text-xs">Available slots in your schedule</p>
      </div>

      {/* Ring */}
      {loading ? (
        <div className="w-8 h-8 md:w-16 md:h-16 rounded-full border-2 border-lime-400/30 border-t-lime-400 animate-spin flex-shrink-0" />
      ) : (
        <>
          <div className="md:hidden">{mobileRing}</div>
          <div className="hidden md:block">{desktopRing}</div>
        </>
      )}
    </div>
  )
}