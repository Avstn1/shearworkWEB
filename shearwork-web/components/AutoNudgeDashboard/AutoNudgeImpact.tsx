'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'

interface Props {
  user_id: string
}

const getCurrentISOWeek = () => {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  monday.setHours(0, 0, 0, 0)

  const startOfYear = new Date(monday.getFullYear(), 0, 1)
  const weekNumber = Math.ceil(((monday.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
  return `${monday.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`
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
      // PGRST116 = no rows found, not a real error
      console.error('Error fetching nudge impact:', error)
      toast.error('Failed to load AutoNudge impact')
      setBookingsRecovered(0)
      setRevenueRecovered(0)
      return
    }

    if (!data) {
      setBookingsRecovered(0)
      setRevenueRecovered(0)
      return
    }

    const bookings = data.client_ids?.length ?? 0
    const revenue = data.prices?.reduce((sum: number, p: number | string) => sum + Number(p), 0) ?? 0

    setBookingsRecovered(bookings)
    setRevenueRecovered(revenue)
  }

  useEffect(() => {
    const init = async () => {
      await fetchImpact()
      setLoading(false)
    }
    init()
  }, [user_id])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('autonudge-impact-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'barber_nudge_success',
          filter: `user_id=eq.${user_id}`,
        },
        () => {
          fetchImpact()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user_id])

  return (
    <div className="relative flex items-center justify-between h-full px-2 overflow-hidden">

      <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full bg-sky-400/8 blur-3xl pointer-events-none" />

      {/* Left — Label */}
      <div className="flex flex-col justify-center">
        <p className="text-white/40 text-xs uppercase tracking-widest font-medium">This Week</p>
        <p className="text-white font-black text-2xl leading-tight mt-1">Corva Impact</p>
      </div>

      {/* Right — Two stats */}
      {loading ? (
        <div className="w-6 h-6 rounded-full border-2 border-sky-400/30 border-t-sky-400 animate-spin flex-shrink-0" />
      ) : (
        <div className="flex items-center gap-6 flex-shrink-0">
          {/* Divider */}
          <div className="w-px h-12 bg-white/10" />

          {/* Bookings */}
          <div className="flex flex-col items-center">
            <span className="text-4xl font-black text-lime-300 leading-none">{bookingsRecovered}</span>
            <span className="text-[10px] text-white/30 mt-1 uppercase tracking-widest">Bookings</span>
          </div>

          <div className="w-px h-12 bg-white/10" />

          {/* Revenue */}
          <div className="flex flex-col items-center">
            <span className="text-4xl font-black text-white leading-none">${revenueRecovered?.toLocaleString()}</span>
            <span className="text-[10px] text-white/30 mt-1 uppercase tracking-widest">Revenue</span>
          </div>
        </div>
      )}
    </div>
  )
}