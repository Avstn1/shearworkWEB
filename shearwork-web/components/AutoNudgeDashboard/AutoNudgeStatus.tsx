'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { Zap, Clock } from 'lucide-react'

interface Props {
  user_id: string
}

const getCurrentISOWeek = (): string => {
  const now = new Date()
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
      const { data } = await supabase
        .from('profiles')
        .select('sms_engaged_current_week')
        .eq('user_id', user_id)
        .single()

      setActive(data?.sms_engaged_current_week ?? false)
      setLoading(false)
    }

    fetchStatus()
  }, [user_id])

  return (
    <div className="relative flex items-center justify-between h-full px-2 overflow-hidden">

      <div className={`absolute -top-10 -right-10 w-48 h-48 rounded-full blur-3xl pointer-events-none ${active ? 'bg-lime-400/8' : 'bg-white/5'}`} />

      {/* Left — Text */}
      <div className="flex flex-col justify-center">
        <p className="text-white/40 text-xs uppercase tracking-widest font-medium">This Week</p>
        <p className="text-white font-black text-2xl leading-tight mt-1">Auto-Nudge</p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <Clock className="w-3 h-3 text-sky-400" />
          <p className="text-sky-400 text-xs">Next: {getNextMonday()} at 10:00 AM</p>
        </div>
      </div>

      {/* Right — Status */}
      {loading ? (
        <div className="w-24 h-24 rounded-full border-2 border-white/10 border-t-white/30 animate-spin flex-shrink-0" />
      ) : (
        <div className={`w-24 h-24 rounded-full border-2 flex flex-col items-center justify-center gap-1 flex-shrink-0 ${
          active
            ? 'border-lime-400 shadow-[0_0_32px_rgba(163,230,53,0.2)]'
            : 'border-white/20'
        }`}>
          <Zap className={`w-6 h-6 ${active ? 'text-lime-400' : 'text-white/20'}`} />
          <span className={`text-xs font-bold ${active ? 'text-lime-400' : 'text-white/30'}`}>
            {active ? 'Active' : 'Inactive'}
          </span>
        </div>
      )}

    </div>
  )
}