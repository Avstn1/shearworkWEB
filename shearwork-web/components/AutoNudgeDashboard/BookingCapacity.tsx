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
  let lower = stops[0], upper = stops[stops.length - 1]
  for (let i = 0; i < stops.length - 1; i++) {
    if (p >= stops[i][0] && p <= stops[i + 1][0]) { lower = stops[i]; upper = stops[i + 1]; break }
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
  const [loading, setLoading] = useState(true)

  const fetchCapacity = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const response = await fetch('/api/acuity/booking-rate', {
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
    })
    if (!response.ok) { toast.error('Failed to load booking data'); setCapacity(null); return }
    const { totalBooked, totalOpen } = await response.json()
    const total = totalBooked + totalOpen
    if (total === 0) { setCapacity(null); return }
    setCapacity(Math.round((totalBooked / total) * 100))
  }

  useEffect(() => {
    const init = async () => { await fetchCapacity(); setLoading(false) }
    init()
  }, [user_id])

  const color = capacity !== null ? getCapacityColor(capacity) : 'rgba(255,255,255,0.2)'

  const desktopRing = (
    <div className="relative flex items-center justify-center flex-shrink-0">
      <svg width="96" height="96" className="-rotate-90">
        <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <circle cx="48" cy="48" r="40" fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * 40}`}
          strokeDashoffset={`${2 * Math.PI * 40 * (1 - (capacity ?? 0) / 100)}`}
          className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-white leading-none">{capacity}%</span>
        <span className="text-[10px] text-white/30 mt-0.5">filled</span>
      </div>
    </div>
  )

  const mobileRing = (
    <div className="relative flex-shrink-0" style={{ width: 64, height: 64 }}>
      <svg viewBox="0 0 64 64" width="64" height="64" className="-rotate-90">
        <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle cx="32" cy="32" r="28" fill="none" stroke={color} strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * 28}`}
          strokeDashoffset={`${2 * Math.PI * 28 * (1 - (capacity ?? 0) / 100)}`}
          className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-black text-white leading-none">{capacity}%</span>
        <span className="text-[8px] text-white/30 mt-0.5">filled</span>
      </div>
    </div>
  )

  return (
    <div className="relative h-full w-full overflow-hidden
      flex flex-col p-3
      md:flex-row md:items-center md:justify-between md:px-2 md:py-0
    ">
      <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-amber-400/8 blur-3xl pointer-events-none" />

      {/* Mobile label — fixed height */}
      <div className="flex flex-col md:hidden" style={{ height: 46 }}>
        <p className="text-white/40 uppercase font-medium tracking-widest text-[9px]">This Week</p>
        <p className="text-white font-black leading-tight mt-0.5 text-sm">Booking Rate</p>
      </div>

      {/* Desktop label */}
      <div className="hidden md:flex flex-col justify-center">
        <p className="text-white/40 uppercase font-medium tracking-widest text-xs">This Week</p>
        <p className="text-white font-black text-2xl leading-tight mt-1">Booking Rate</p>
      </div>

      {/* Mobile ring */}
      <div className="md:hidden mt-auto">
        {loading
          ? <div className="w-8 h-8 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin" />
          : capacity === null
          ? <p className="text-white/20 text-xs">No data</p>
          : mobileRing}
      </div>

      {/* Desktop ring */}
      <div className="hidden md:block">
        {loading
          ? <div className="w-16 h-16 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin flex-shrink-0" />
          : capacity === null
          ? <p className="text-white/20 text-xs flex-shrink-0">No data</p>
          : desktopRing}
      </div>
    </div>
  )
}