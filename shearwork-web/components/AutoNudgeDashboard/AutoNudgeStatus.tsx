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

const getNextMonday = (weekday: 'long' | 'short' = 'long'): string => {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  const nextMonday = new Date(now)
  nextMonday.setDate(now.getDate() + daysUntilMonday)
  return nextMonday.toLocaleDateString('en-US', {
    weekday, month: 'short', day: 'numeric'
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

  return (
    <div data-tone="violet" className="stat-root tone-violet flex h-full w-full flex-col justify-between gap-2 overflow-hidden p-3 md:flex-row md:items-center md:gap-4 md:p-5">
      <div className="min-w-0">
        <p className="stat-label">Auto-Nudge</p>
        <p
          className={`stat-value mt-1.5 text-lg md:mt-2 md:text-[1.75rem] ${
            active ? 'text-sage-bright' : 'text-muted'
          }`}
        >
          {loading ? '\u2014' : active ? 'Active' : 'Inactive'}
        </p>
        {/* Phones: one short line like the other stat cards; desktop has room for the full time */}
        <p className="mt-1.5 text-xs leading-snug text-gray-500 md:hidden">Next: <span className="whitespace-nowrap">{getNextMonday('short')}</span></p>
        <p className="mt-1.5 hidden items-start gap-1.5 text-xs leading-snug text-gray-500 md:flex">
          <Clock className="mt-px h-3 w-3 flex-shrink-0" strokeWidth={1.75} />
          <span>Next: {getNextMonday()} at 10:00 AM</span>
        </p>
      </div>

      <div className="relative hidden h-12 w-12 flex-shrink-0 md:block md:h-20 md:w-20">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
          {!loading && active && (
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgb(167 139 250)" strokeWidth="8"
              strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 42}`} strokeDashoffset={0}
              className="transition-all duration-700" />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Zap
            className={`h-4 w-4 md:h-5 md:w-5 ${active ? 'text-sage' : 'text-gray-600'}`}
            strokeWidth={1.75}
          />
        </div>
      </div>
    </div>
  )
}
