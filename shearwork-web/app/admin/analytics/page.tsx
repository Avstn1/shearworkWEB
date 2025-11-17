'use client'

import { useEffect, useState, useRef } from 'react'
import Navbar from '@/components/Navbar'
import 'react-day-picker/dist/style.css'
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from 'date-fns'
import DateRange from 'react-day-picker'

import HourlyLoginChart from '@/components/AdminComponents/AdminAnalytics/LoginCharts/HourlyLoginChart'
import WeeklyLoginChart from '@/components/AdminComponents/AdminAnalytics/LoginCharts/WeeklyLoginChart'

const DATE_PRESETS = ['Day', 'Week', 'Month'] as const

export default function AnalyticsPage() {
  const [datePreset, setDatePreset] = useState<typeof DATE_PRESETS[number]>('Month')
  const [targetDate, setTargetDate] = useState<string>('')
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined)
  const [showCustomPicker, setShowCustomPicker] = useState(false)
  const [loading, setLoading] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Close custom picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowCustomPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Update targetDate when preset changes
  useEffect(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const localDate = `${year}-${month}-${day}`

    switch (datePreset) {
      case 'Day':
        setTargetDate(localDate)
        setShowCustomPicker(false)
        break
      case 'Week':
      case 'Month':
        setTargetDate('')
        setShowCustomPicker(false)
        break
      case 'Custom':
        setShowCustomPicker(true)
        break
    }
  }, [datePreset])

  // Refresh handler
  const handleRefresh = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ targetDate: targetDate || new Date().toISOString().slice(0, 10) }),
      })
      const data = await res.json()
      console.log('Analytics refreshed:', data)
    } catch (err) {
      console.error('Failed to refresh analytics:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Navbar />
      <div className="flex flex-col gap-5 text-[var(--foreground)] bg-[var(--background)] min-h-screen p-3 sm:p-6 overflow-y-auto">
        <h1 className="text-3xl font-bold text-[var(--highlight)] mb-6">Analytics</h1>

        {/* Filter bar */}
        <div className="sticky top-0 z-20 bg-[#1f2420] p-3 border-b border-[#55694b] flex items-center gap-2">
          <h2 className="text-lg font-medium">Filters</h2>
          <div className="flex-1" />
          <button
            onClick={handleRefresh}
            className="px-4 py-1 rounded-md bg-[var(--accent-3)] hover:bg-[var(--accent-4)] text-[var(--text-bright)] font-medium"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Charts side by side */}
        <div className="flex flex-col gap-4 sm:flex-row">
          {/* Hourly Login Chart */}
          <div className="flex-1 bg-[var(--accent-2)]/10 rounded-xl shadow-md border border-[var(--accent-2)]/30 p-4 pb-[3rem] relative min-h-[250px]">
            {/* Preset buttons inside chart top-right */}
            <div className="absolute top-3 right-3 flex gap-2 z-10">
              {DATE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setDatePreset(preset)}
                  className={`px-3 py-1 rounded-md border text-sm font-medium transition-colors ${
                    datePreset === preset
                      ? 'bg-[var(--accent-3)] border-[var(--accent-3)] text-[var(--text-bright)]'
                      : 'bg-[var(--accent-1)] border-[var(--accent-2)] text-[var(--text-bright)] hover:bg-[var(--accent-1)]/30'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            <div className="w-full h-full">
              <HourlyLoginChart
                targetDate={targetDate}
                startDate={
                  datePreset === 'Week'
                    ? startOfWeek(new Date(), { weekStartsOn: 1 }).toLocaleDateString('en-CA')
                    : customRange?.from
                    ? startOfDay(customRange.from).toLocaleDateString('en-CA')
                    : datePreset === 'Month'
                    ? startOfMonth(new Date()).toLocaleDateString('en-CA')
                    : undefined
                }
                endDate={
                  datePreset === 'Week'
                    ? endOfWeek(new Date(), { weekStartsOn: 1 }).toLocaleDateString('en-CA')
                    : customRange?.to
                    ? endOfDay(customRange.to).toLocaleDateString('en-CA')
                    : datePreset === 'Month'
                    ? endOfMonth(new Date()).toLocaleDateString('en-CA')
                    : undefined
                }
              />
            </div>
          </div>

          {/* Weekly Login Chart */}
          <div className="flex-1 bg-[var(--accent-2)]/10 rounded-xl shadow-md border border-[var(--accent-2)]/30 p-4 relative min-h-[250px]">
            {/* Preset buttons inside chart top-right */}
            <div className="absolute top-3 right-3 flex gap-2 z-10">
              {DATE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setDatePreset(preset)}
                  className={`px-3 py-1 rounded-md border text-sm font-medium transition-colors ${
                    datePreset === preset
                      ? 'bg-[var(--accent-3)] border-[var(--accent-3)] text-[var(--text-bright)]'
                      : 'bg-[var(--accent-1)] border-[var(--accent-2)] text-[var(--text-bright)] hover:bg-[var(--accent-1)]/30'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            <div className="w-full h-full">
              <WeeklyLoginChart
                weekStart={startOfWeek(new Date(), { weekStartsOn: 1 }).toLocaleDateString('en-CA')}
                weekEnd={endOfWeek(new Date(), { weekStartsOn: 1 }).toLocaleDateString('en-CA')}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
