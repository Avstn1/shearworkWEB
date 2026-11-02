'use client'

import React, { useEffect, useState, useRef } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/utils/supabaseClient'

interface DailySelectorProps {
  userId: string
  selectedYear: number
  selectedMonth: string
  selectedDay: number
  setSelectedDay: (day: number) => void
  disabled?: boolean
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

export default function DailySelector({
  userId,
  selectedYear,
  selectedMonth,
  selectedDay,
  setSelectedDay,
  disabled
}: DailySelectorProps) {
  const [open, setOpen] = useState(false)
  const [availableDays, setAvailableDays] = useState<number[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const today = new Date()
  const isCurrentMonth =
    today.getFullYear() === selectedYear &&
    MONTHS[today.getMonth()] === selectedMonth
  const maxSelectableDay = isCurrentMonth ? today.getDate() : Infinity

  // Fetch only days that actually have data for the month/year
  useEffect(() => {
    if (!userId) return

    const fetchDaysWithData = async () => {
      try {
        const monthIndex = MONTHS.indexOf(selectedMonth)
        const monthStr = String(monthIndex + 1).padStart(2, '0')

        const { data, error } = await supabase
          .from('daily_data')
          .select('date, total_revenue')
          .eq('user_id', userId)
          .eq('month', selectedMonth)
          .eq('year', selectedYear)
          .order('date', { ascending: true })

        if (error) throw error

        // Extract day numbers from YYYY-MM-DD
        let days =
          data
            ?.filter((d) => d.total_revenue > 0) 
            .map((d) => parseInt(d.date.split('-')[2], 10)) ?? []

        // Determine if this is the current month
        const today = new Date()
        const isCurrentMonth =
          today.getFullYear() === selectedYear &&
          MONTHS[today.getMonth()] === selectedMonth

        const maxSelectableDay = isCurrentMonth ? today.getDate() : Infinity

        // ❗ Filter out days beyond today if this month is current
        if (isCurrentMonth) {
          days = days.filter((day) => day <= maxSelectableDay)
        }

        setAvailableDays(days)

        // Set currentIndex based on selectedDay
        const idx = days.indexOf(selectedDay)
        setCurrentIndex(days.length ? (idx >= 0 ? idx : days.length - 1) : 0)
      } catch (err) {
        console.error('Error fetching daily data:', err)
      }
    }

    fetchDaysWithData()
  }, [userId, selectedYear, selectedMonth, selectedDay])


  // Sync selectedDay when currentIndex changes
  useEffect(() => {
    if (availableDays.length && currentIndex >= 0 && currentIndex < availableDays.length) {
      setSelectedDay(availableDays[currentIndex])
    }
  }, [currentIndex, availableDays])

  // Close dropdown if clicked outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (day: number) => {
    if (disabled) return
    const idx = availableDays.indexOf(day)
    if (idx >= 0) setCurrentIndex(idx)
    setOpen(false)
  }

  const goPrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1)
  }

  const goNext = () => {
    if (currentIndex < availableDays.length - 1) {
      const nextDay = availableDays[currentIndex + 1]
      if (nextDay <= maxSelectableDay) {
        setCurrentIndex(currentIndex + 1)
      }
    }
  }


  return (
    <div className="relative flex items-center gap-0.5" ref={containerRef}>
      <button
        type="button"
        aria-label="Previous day"
        onClick={goPrev}
        disabled={currentIndex <= 0 || disabled}
        className="inline-flex h-9 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/[0.06] hover:text-ivory disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
      </button>

      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select day"
        onClick={() => !disabled && setOpen(!open)}
        className={`flex h-9 items-center justify-between gap-2 rounded-lg border border-white/[0.09] bg-canvas px-3 text-sm font-medium text-ivory transition-colors hover:border-white/[0.16] min-w-[64px] tabular-nums ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
      >
        {availableDays[currentIndex] ?? '-'}
        <ChevronDown className="h-4 w-4 text-gray-400" strokeWidth={1.75} />
      </button>

      <button
        type="button"
        aria-label="Next day"
        onClick={goNext}
        disabled={
          disabled ||
          currentIndex >= availableDays.length - 1 ||
          (isCurrentMonth && availableDays[currentIndex + 1] > maxSelectableDay)
        }
        className="inline-flex h-9 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/[0.06] hover:text-ivory disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
      </button>

      {open && (
        <ul role="listbox" className="absolute left-7 top-full z-50 mt-1 max-h-48 w-[64px] overflow-y-auto rounded-lg border border-white/[0.12] bg-raised py-1 shadow-lg">
          {availableDays.map((day) => (
            <li
              key={day}
              role="option"
              aria-selected={day === selectedDay}
              onClick={() => handleSelect(day)}
              className={`w-full cursor-pointer select-none px-3 py-1.5 text-left text-sm transition-colors tabular-nums ${day === selectedDay ? 'bg-sage/[0.12] text-sage-bright' : 'text-gray-300 hover:bg-white/[0.05] hover:text-ivory'}`}
            >
              {day}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
