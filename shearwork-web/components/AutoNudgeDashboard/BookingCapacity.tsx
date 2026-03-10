'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'

interface Props {
  user_id: string
}

export default function BookingCapacity({ user_id }: Props) {
  const [capacity, setCapacity] = useState<number | null>(null)
  const [totalSlots, setTotalSlots] = useState<number>(0)
  const [totalUpdated, setTotalUpdated] = useState<number>(0)
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

  const fetchCapacity = async () => {
    const { start, end } = getWeekRange()

    const { data, error } = await supabase
      .from('availability_daily_summary')
      .select('slot_count, slot_count_update')
      .eq('user_id', user_id)
      .gte('slot_date', start)
      .lte('slot_date', end)

    if (error) {
      console.error('Error fetching capacity:', error)
      toast.error('Failed to load booking capacity')
      setCapacity(null)
      return
    }

    const totalSlots = data?.reduce((sum, row) => sum + (row.slot_count || 0), 0) ?? 0
    const totalUpdated = data?.reduce((sum, row) => sum + (row.slot_count_update || 0), 0) ?? 0

    if (totalSlots === 0) {
      setCapacity(null)
      return
    }

    setTotalSlots(totalSlots)
    setTotalUpdated(totalUpdated)
    const percentage = 100 - (totalUpdated / totalSlots) * 100
    setCapacity(Math.round(percentage))
  }

  useEffect(() => {
    const init = async () => {
      await fetchCapacity()
      setLoading(false)
    }
    init()
  }, [user_id])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('booking-capacity-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'availability_daily_summary',
          filter: `user_id=eq.${user_id}`,
        },
        () => {
          fetchCapacity()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user_id])

  const filledSlots = totalSlots - totalUpdated

  return (
    <div className="relative flex items-center justify-between h-full px-2 overflow-hidden">

      <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-amber-400/8 blur-3xl pointer-events-none" />

      {/* Left — Text */}
      <div className="flex flex-col justify-center">
        <p className="text-white/40 text-xs uppercase tracking-widest font-medium">This Week</p>
        <p className="text-white font-black text-2xl leading-tight mt-1">Booking Rate</p>
        <div className="flex gap-3 mt-2 text-xs text-white/30">
          <span><span className="text-white/60 font-medium">{filledSlots}</span> booked</span>
          <span><span className="text-white/60 font-medium">{totalUpdated}</span> remaining</span>
        </div>
      </div>

      {/* Right — Percentage */}
      {loading ? (
        <div className="w-16 h-16 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin flex-shrink-0" />
      ) : capacity === null ? (
        <p className="text-white/20 text-sm flex-shrink-0">No data</p>
      ) : (
        <div className="relative flex items-center justify-center flex-shrink-0">
          <svg width="96" height="96" className="-rotate-90">
            <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
            <circle
              cx="48" cy="48" r="40" fill="none"
              stroke="url(#capacityGrad)" strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 40}`}
              strokeDashoffset={`${2 * Math.PI * 40 * (1 - capacity / 100)}`}
              className="transition-all duration-700"
            />
            <defs>
              <linearGradient id="capacityGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#fde68a" />
                <stop offset="100%" stopColor="#a3e635" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
            <span className="text-2xl font-black text-white leading-none">{capacity}%</span>
            <span className="text-[10px] text-white/30 mt-0.5">filled</span>
          </div>
        </div>
      )}
    </div>
  )
}