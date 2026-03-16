'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { Zap, Clock } from 'lucide-react'

interface Props {
  user_id: string
}

const getCurrentISOWeek = (): string => {
  const torontoDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

  const [year, month, day] = torontoDateStr.split('-').map(Number)
  const now = new Date(year, month - 1, day)

  const dayOfWeek = now.getDay() || 7
  const thursday = new Date(now)
  thursday.setDate(now.getDate() - dayOfWeek + 4)
  const jan4 = new Date(thursday.getFullYear(), 0, 4)
  const jan4Day = jan4.getDay() || 7
  const firstMonday = new Date(jan4)
  firstMonday.setDate(jan4.getDate() - jan4Day + 1)
  const weekNumber = Math.round((thursday.getTime() - firstMonday.getTime()) / (7 * 86400000)) + 1
  return `${thursday.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`
}

const getNextMonday = (): string => {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  const nextMonday = new Date(now)
  nextMonday.setDate(now.getDate() + daysUntilMonday)
  return nextMonday.toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric'
  })
}

export default function AutoNudgeStatus({ user_id }: Props) {
  const [active, setActive] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStatus = async () => {
      const isoWeek = getCurrentISOWeek()
      const { data } = await supabase
        .from('sms_smart_buckets')
        .select('bucket_id')
        .eq('user_id', user_id)
        .eq('iso_week', isoWeek)
        .single()
      setActive(!!data)
      setLoading(false)
    }
    fetchStatus()
  }, [user_id])

  const desktopRing = (
    <div className="relative flex items-center justify-center flex-shrink-0">
      <svg width="96" height="96" className="-rotate-90">
        <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        {active && (
          <circle cx="48" cy="48" r="40" fill="none" stroke="#a3e635" strokeWidth="8"
            strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 40}`} strokeDashoffset={0}
            className="transition-all duration-700" />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
        <Zap className={`w-5 h-5 ${active ? 'text-lime-400' : 'text-white/20'}`} />
        <span className={`text-xs font-bold ${active ? 'text-lime-400' : 'text-white/30'}`}>
          {active ? 'Active' : 'Inactive'}
        </span>
      </div>
    </div>
  )

  const mobileRing = (
    <div className="relative flex-shrink-0" style={{ width: 64, height: 64 }}>
      <svg viewBox="0 0 64 64" width="64" height="64" className="-rotate-90">
        <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        {active && (
          <circle cx="32" cy="32" r="28" fill="none" stroke="#a3e635" strokeWidth="6"
            strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 28}`} strokeDashoffset={0}
            className="transition-all duration-700" />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <Zap className={`w-4 h-4 ${active ? 'text-lime-400' : 'text-white/20'}`} />
        <span className={`text-[9px] font-bold ${active ? 'text-lime-400' : 'text-white/30'}`}>
          {active ? 'Active' : 'Inactive'}
        </span>
      </div>
    </div>
  )

  return (
    <div className={`relative h-full w-full overflow-hidden
      flex flex-col p-3
      md:flex-row md:items-center md:justify-between md:px-2 md:py-0
    `}>
      <div className={`absolute -top-10 -right-10 w-48 h-48 rounded-full blur-3xl pointer-events-none ${active ? 'bg-lime-400/8' : 'bg-white/5'}`} />

      {/* Mobile label — fixed height matching other cards */}
      <div className="flex flex-col md:hidden" style={{ height: 46 }}>
        <p className="text-white/40 uppercase font-medium tracking-widest text-[9px]">This Week</p>
        <p className="text-white font-black leading-tight mt-0.5 text-sm">Auto-Nudge</p>
        <div className="flex items-center gap-1 text-[9px] text-white/30 mt-1">
          <Clock className="w-2.5 h-2.5 flex-shrink-0" />
          <span>Next: {getNextMonday()}</span>
        </div>
      </div>

      {/* Desktop label */}
      <div className="hidden md:flex flex-col justify-center">
        <p className="text-white/40 uppercase font-medium tracking-widest text-xs">This Week</p>
        <p className="text-white font-black text-2xl leading-tight mt-1">Auto-Nudge</p>
        <div className="flex items-center gap-1.5 mt-2 text-xs text-white/30">
          <Clock className="w-3 h-3" />
          <span>Next: {getNextMonday()} at 10:00 AM</span>
        </div>
      </div>

      {/* Mobile ring */}
      <div className="md:hidden mt-auto">
        {loading
          ? <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white/30 animate-spin" />
          : mobileRing}
      </div>

      {/* Desktop ring */}
      <div className="hidden md:block">
        {loading
          ? <div className="w-16 h-16 rounded-full border-2 border-white/10 border-t-white/30 animate-spin flex-shrink-0" />
          : desktopRing}
      </div>
    </div>
  )
}