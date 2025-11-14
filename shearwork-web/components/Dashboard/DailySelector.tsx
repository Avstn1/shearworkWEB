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
          .select('date')
          .eq('user_id', userId)
          .eq('month', selectedMonth)
          .eq('year', selectedYear)
          .order('date', { ascending: true })

        if (error) throw error

        // Extract day numbers from YYYY-MM-DD
        let days =
          data?.map((d) => parseInt(d.date.split('-')[2], 10)) ?? []

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
    <div className="relative w-28 flex items-center gap-1" ref={containerRef}>
      <button onClick={goPrev} 
        disabled={currentIndex <= 0 || disabled} 
        className="p-1 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        className={`
          flex-1 flex justify-between items-center px-3 py-2 rounded-full font-semibold text-sm border shadow-md
          bg-gradient-to-r from-amber-500/30 to-lime-500/30 text-white
          transition-all duration-200
          hover:scale-105 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-1
          ${disabled ? 'opacity-50 cursor-not-allowed hover:scale-100 focus:ring-0' : ''}
        `}
      >
        {availableDays[currentIndex] ?? '-'}
        <ChevronDown className="ml-2 h-4 w-4" />
      </button>

      <button
        onClick={goNext}
        disabled={
          disabled ||
          currentIndex >= availableDays.length - 1 ||
          (isCurrentMonth && availableDays[currentIndex + 1] > maxSelectableDay)
        }
        className="p-1 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-4 h-4" />
      </button>


      {open && (
        <ul className="absolute top-full mt-1 w-full max-h-40 overflow-y-auto rounded-lg border border-white/20 bg-[#1a1e18] shadow-lg z-50">
          {availableDays.map((day) => (
            <li
              key={day}
              onClick={() => handleSelect(day)}
              className={`
                px-4 py-2 cursor-pointer select-none
                ${day === selectedDay
                  ? 'bg-amber-300 text-black font-semibold'
                  : 'text-white hover:bg-white/20 hover:text-black'
                }
              `}
            >
              {day}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
