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
    <div className="relative h-full w-full
      flex flex-col items-center justify-center
      2xl:flex-row 2xl:items-center 2xl:justify-between
      px-3 md:px-2
    ">
      <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full bg-sky-400/8 blur-3xl pointer-events-none" />

      {/* Label */}
      <div className="flex flex-col items-center 2xl:items-start text-center 2xl:text-left">
        <p className="text-white/40 uppercase font-medium tracking-widest text-[9px] md:text-xs">This Week</p>
        <p className="text-white font-black leading-tight mt-0.5 text-sm md:hidden">Corva's Impact</p>
        <p className="hidden md:block text-white font-black text-2xl leading-tight mt-1">Corva's Impact</p>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="mt-3 2xl:mt-0">
          <div className="w-6 h-6 rounded-full border-2 border-sky-400/30 border-t-sky-400 animate-spin" />
        </div>
      ) : (
        <div className="flex items-center justify-center gap-4 md:gap-6 mt-3 2xl:mt-0">
          <div className="w-px h-10 bg-white/10 hidden 2xl:block" />
          <div className="flex flex-col items-center">
            <span className="text-2xl md:text-4xl font-black text-lime-300 leading-none">{bookingsRecovered}</span>
            <span className="text-[9px] md:text-[10px] text-white/30 mt-1 uppercase tracking-widest">Bookings</span>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="flex flex-col items-center">
            <span className="text-2xl md:text-4xl font-black text-white leading-none">${revenueRecovered?.toLocaleString()}</span>
            <span className="text-[9px] md:text-[10px] text-white/30 mt-1 uppercase tracking-widest">Revenue</span>
          </div>
        </div>
      )}
    </div>
  )
}