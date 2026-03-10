'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'

interface Props {
  user_id: string
}

const getCapacityColor = (pct: number): string => {
  const p = Math.max(0, Math.min(100, pct))

  const stops: [number, number, number, number][] = [
    [0,   220, 38,  38 ],
    [25,  234, 88,  12 ],
    [50,  234, 179, 8  ],
    [75,  132, 204, 22 ],
    [100, 34,  197, 94 ],
  ]

  let lower = stops[0]
  let upper = stops[stops.length - 1]
  for (let i = 0; i < stops.length - 1; i++) {
    if (p >= stops[i][0] && p <= stops[i + 1][0]) {
      lower = stops[i]
      upper = stops[i + 1]
      break
    }
  }

  const range = upper[0] - lower[0]
  const t = range === 0 ? 0 : (p - lower[0]) / range
  const r = Math.round(lower[1] + (upper[1] - lower[1]) * t)
  const g = Math.round(lower[2] + (upper[2] - lower[2]) * t)
  const b = Math.round(lower[3] + (upper[3] - lower[3]) * t)
  return `rgb(${r}, ${g}, ${b})`
}

export default function BookingCapacity({ user_id }: Props) {
  const [capacity, setCapacity] = useState<number | null>(null)
  const [bookedSlots, setBookedSlots] = useState<number>(0)
  const [openSlots, setOpenSlots] = useState<number>(0)
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

    // 1. Get open slots from availability_slots for this week
    // Deduplicate on slot_date + start_time to avoid counting the same
    // time slot multiple times (once per appointment type)
    const { data: slotsData, error: slotsError } = await supabase
      .from('availability_slots')
      .select('slot_date, start_time')
      .eq('user_id', user_id)
      .gte('slot_date', start)
      .lte('slot_date', end)

    if (slotsError) {
      console.error('Error fetching availability slots:', slotsError)
      toast.error('Failed to load availability slots')
      setCapacity(null)
      return
    }

    // Count unique slot_date + start_time combinations
    const uniqueSlots = new Set(
      slotsData?.map(s => `${s.slot_date}|${s.start_time}`) ?? []
    )

    // 2. Get booked count directly from Acuity via API route
    // This includes future appointments this week that haven't synced yet
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    const response = await fetch('/api/acuity/booking-rate', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })

    if (!response.ok) {
      console.error('Failed to fetch booking rate from Acuity')
      toast.error('Failed to load booked appointments')
      setCapacity(null)
      return
    }

    const { bookedSlotUnits } = await response.json()

    const totalOpen = uniqueSlots.size
    const totalBooked = bookedSlotUnits ?? 0
    const total = totalBooked + totalOpen

    setOpenSlots(totalOpen)
    setBookedSlots(totalBooked)

    if (total === 0) {
      setCapacity(null)
      return
    }

    // Booking rate = booked / (booked + open)
    const percentage = Math.round((totalBooked / total) * 100)
    setCapacity(percentage)
  }

  useEffect(() => {
    const init = async () => {
      await fetchCapacity()
      setLoading(false)
    }
    init()
  }, [user_id])

  // Realtime: re-fetch when availability slots change
  useEffect(() => {
    const availChannel = supabase
      .channel('booking-capacity-availability')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'availability_slots',
          filter: `user_id=eq.${user_id}`,
        },
        () => fetchCapacity()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(availChannel)
    }
  }, [user_id])

  const color = capacity !== null ? getCapacityColor(capacity) : 'rgba(255,255,255,0.2)'

  return (
    <div className="relative flex items-center justify-between h-full px-2 overflow-hidden">

      <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-amber-400/8 blur-3xl pointer-events-none" />

      {/* Left — Text */}
      <div className="flex flex-col justify-center">
        <p className="text-white/40 text-xs uppercase tracking-widest font-medium">This Week</p>
        <p className="text-white font-black text-2xl leading-tight mt-1">Booking Rate</p>
        <div className="flex gap-3 mt-2 text-xs text-white/30">
          <span><span className="text-white/60 font-medium">{bookedSlots}</span> booked</span>
          <span><span className="text-white/60 font-medium">{openSlots}</span> remaining</span>
        </div>
      </div>

      {/* Right — Ring */}
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
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 40}`}
              strokeDashoffset={`${2 * Math.PI * 40 * (1 - capacity / 100)}`}
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black text-white leading-none">{capacity}%</span>
            <span className="text-[10px] text-white/30 mt-0.5">filled</span>
          </div>
        </div>
      )}
    </div>
  )
}