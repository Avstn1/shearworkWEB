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
    const init = async () => {
      await fetchOpenings()
      setLoading(false)
    }
    init()
  }, [user_id])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('open-bookings-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'availability_daily_summary',
          filter: `user_id=eq.${user_id}`,
        },
        () => {
          fetchOpenings()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user_id])

  return (
    <div className="relative flex items-center justify-between h-full px-2 overflow-hidden">

      <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-lime-400/8 blur-3xl pointer-events-none" />

      {/* Left — Text */}
      <div className="flex flex-col justify-center">
        <p className="text-white/40 text-xs uppercase tracking-widest font-medium">This Week</p>
        <p className="text-white font-black text-2xl leading-tight mt-1">Open Bookings</p>
        <p className="text-white/30 text-xs mt-1.5">Available slots in your schedule</p>
      </div>

      {/* Right — Circle */}
      {loading ? (
        <div className="w-20 h-20 rounded-full border-2 border-lime-400/30 border-t-lime-400 animate-spin flex-shrink-0" />
      ) : (
        <div className="w-24 h-24 rounded-full border-2 border-lime-400 flex items-center justify-center shadow-[0_0_32px_rgba(163,230,53,0.2)] flex-shrink-0">
          <span className="text-4xl font-black text-lime-400 leading-none">{totalOpenings}</span>
        </div>
      )}

    </div>
  )
}