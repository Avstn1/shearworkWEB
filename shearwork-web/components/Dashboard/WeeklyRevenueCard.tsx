'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { useBarberLabel } from '@/hooks/useBarberLabel'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface WeeklyRevenueCardProps {
  userId: string
  selectedMonth?: string // e.g. "March"
  selectedYear?: number
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

/**
 * Returns the Monday for the ISO week that contains `date`.
 */
function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0 = Sun, 1 = Mon …
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Build every Mon–Sun week that overlaps a given month.
 */
function getWeeksForMonth(monthIndex: number, year: number): { weekStart: string; weekEnd: string }[] {
  const weeks: { weekStart: string; weekEnd: string }[] = []
  const seen = new Set<string>()

  const firstDay = new Date(year, monthIndex, 1)
  const lastDay = new Date(year, monthIndex + 1, 0)

  let cursor = getMonday(firstDay)
  const lastMonday = getMonday(lastDay)

  while (cursor <= lastMonday) {
    const monday = new Date(cursor)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)

    const fmt = (dt: Date) => dt.toISOString().slice(0, 10)
    const key = fmt(monday)

    if (!seen.has(key)) {
      seen.add(key)
      weeks.push({ weekStart: fmt(monday), weekEnd: fmt(sunday) })
    }

    cursor.setDate(cursor.getDate() + 7)
  }

  return weeks
}

/**
 * Pretty-print a Mon–Sun range, e.g. "Mar 10 – Mar 16"
 */
function formatWeekLabel(weekStart: string, weekEnd: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  const start = new Date(weekStart + 'T00:00:00')
  const end = new Date(weekEnd + 'T00:00:00')
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`
}

export default function WeeklyRevenueCard({ userId, selectedMonth, selectedYear }: WeeklyRevenueCardProps) {
  const [revenue, setRevenue] = useState<number | null>(null)
  const [tips, setTips] = useState<number | null>(null)
  const [prevRevenue, setPrevRevenue] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [barberType, setBarberType] = useState<'rental' | 'commission' | undefined>()
  const [commissionRate, setCommissionRate] = useState<number | null>(null)
  const [weekIndex, setWeekIndex] = useState<number>(0)
  const { label } = useBarberLabel(barberType)

  const currentYear = selectedYear ?? new Date().getFullYear()
  const monthIndex = selectedMonth ? MONTHS.indexOf(selectedMonth) : new Date().getMonth()

  // ── Derive weeks for the selected month ────────────────────────────
  const weeks = useMemo(() => getWeeksForMonth(monthIndex, currentYear), [monthIndex, currentYear])

  // Reset to the week containing today (or last week) when month/year changes
  useEffect(() => {
    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)

    if (today.getMonth() === monthIndex && today.getFullYear() === currentYear) {
      const idx = weeks.findIndex(w => todayStr >= w.weekStart && todayStr <= w.weekEnd)
      setWeekIndex(idx >= 0 ? idx : weeks.length - 1)
    } else {
      setWeekIndex(weeks.length - 1)
    }
  }, [weeks, monthIndex, currentYear])

  const currentWeek = weeks[weekIndex] ?? weeks[0]

  // Previous week: either the prior entry in the array or calculate from prior month
  const prevWeek = weekIndex > 0
    ? weeks[weekIndex - 1]
    : (() => {
        const mon = new Date(currentWeek.weekStart + 'T00:00:00')
        mon.setDate(mon.getDate() - 7)
        const sun = new Date(mon)
        sun.setDate(mon.getDate() + 6)
        const fmt = (dt: Date) => dt.toISOString().slice(0, 10)
        return { weekStart: fmt(mon), weekEnd: fmt(sun) }
      })()

  // ── Fetch profile ──────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return

    const fetchProfile = async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, barber_type, commission_rate')
          .eq('user_id', userId)
          .maybeSingle()

        if (profile?.role?.toLowerCase() === 'barber') {
          setBarberType(profile.barber_type ?? undefined)
          setCommissionRate(profile.commission_rate ?? null)
        }
      } catch (err) {
        console.error('Error fetching profile:', err)
      }
    }

    fetchProfile()
  }, [userId])

  // ── Fetch weekly revenue ───────────────────────────────────────────
  useEffect(() => {
    if (!userId || !currentWeek) return

    const fetchWeeklyRevenue = async () => {
      setLoading(true)
      try {
        // ── Current week ──
        const { data: currentRows, error: currentError } = await supabase
          .from('daily_data')
          .select('total_revenue, tips')
          .eq('user_id', userId)
          .gte('date', currentWeek.weekStart)
          .lte('date', currentWeek.weekEnd)

        if (currentError) throw currentError

        if (currentRows && currentRows.length > 0) {
          const totalRevenue = currentRows.reduce((sum, row) => sum + Number(row.total_revenue || 0), 0)
          const totalTips = currentRows.reduce((sum, row) => sum + Number(row.tips || 0), 0)

          const finalRevenue =
            barberType === 'commission' && commissionRate !== null
              ? totalRevenue * commissionRate + totalTips
              : totalRevenue + totalTips

          setRevenue(finalRevenue)
          setTips(totalTips)
        } else {
          setRevenue(null)
          setTips(null)
        }

        // ── Previous week ──
        const { data: prevRows, error: prevError } = await supabase
          .from('daily_data')
          .select('total_revenue, tips')
          .eq('user_id', userId)
          .gte('date', prevWeek.weekStart)
          .lte('date', prevWeek.weekEnd)

        if (prevError) throw prevError

        if (prevRows && prevRows.length > 0) {
          const prevTotalRevenue = prevRows.reduce((sum, row) => sum + Number(row.total_revenue || 0), 0)
          const prevTotalTips = prevRows.reduce((sum, row) => sum + Number(row.tips || 0), 0)

          const prevFinal =
            barberType === 'commission' && commissionRate !== null
              ? prevTotalRevenue * commissionRate + prevTotalTips
              : prevTotalRevenue + prevTotalTips

          setPrevRevenue(prevFinal)
        } else {
          setPrevRevenue(null)
        }
      } catch (err) {
        console.error('Error fetching weekly revenue:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchWeeklyRevenue()
  }, [userId, currentWeek?.weekStart, barberType, commissionRate])

  // ── Helpers ────────────────────────────────────────────────────────
  const formatCurrency = (amount: number) =>
    `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const change =
    revenue !== null && prevRevenue !== null && prevRevenue !== 0
      ? parseFloat(((revenue - prevRevenue) / prevRevenue * 100).toFixed(2))
      : null

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="w-full h-full flex flex-col">
      {/* Header row: title + chevron navigator */}
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-[#8a9b90] text-base font-semibold">📅 Weekly {label}</h2>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekIndex(i => Math.max(0, i - 1))}
            disabled={weekIndex <= 0}
            className="p-0.5 rounded hover:bg-white/10 text-white/40 hover:text-white disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
            aria-label="Previous week"
          >
            <ChevronLeft size={16} />
          </button>

          <span className="text-xs text-white/40 min-w-[120px] text-center select-none">
            {currentWeek ? formatWeekLabel(currentWeek.weekStart, currentWeek.weekEnd) : '—'}
          </span>

          <button
            onClick={() => setWeekIndex(i => Math.min(weeks.length - 1, i + 1))}
            disabled={weekIndex >= weeks.length - 1}
            className="p-0.5 rounded hover:bg-white/10 text-white/40 hover:text-white disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
            aria-label="Next week"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Week indicator dots */}
      <div className="flex items-center gap-1 mb-2">
        {weeks.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setWeekIndex(idx)}
            className={`h-1.5 rounded-full transition-all duration-200 ${
              idx === weekIndex
                ? 'w-4 bg-[#6ee7b7]'
                : 'w-1.5 bg-white/10 hover:bg-white/20'
            }`}
            aria-label={`Week ${idx + 1}`}
          />
        ))}
      </div>

      {/* Revenue display */}
      <div className="flex-1 flex flex-col justify-center">
        <p className="text-3xl font-bold text-white">
          {loading
            ? 'Loading...'
            : revenue !== null
              ? formatCurrency(revenue)
              : 'No revenue this week!'}
        </p>
        {!loading && tips !== null && tips > 0 && (
          <p className="text-sm text-white/30 mt-1">
            (includes {formatCurrency(tips)} in tips)
          </p>
        )}
      </div>

      {/* Comparison footer */}
      <div className="mt-auto">
        {change !== null ? (
          <p
            className={`text-sm font-semibold ${
              change > 0
                ? 'text-[#6ee7b7]'
                : change < 0
                  ? 'text-[#fbbf24]'
                  : 'text-[#555]'
            }`}
          >
            {change > 0 ? `+${change}%` : `${change}%`}{' '}
            <span className="text-[#555]">(vs. {formatWeekLabel(prevWeek.weekStart, prevWeek.weekEnd)})</span>
          </p>
        ) : (
          <p className="text-sm text-[#555]">—</p>
        )}
      </div>
    </div>
  )
}