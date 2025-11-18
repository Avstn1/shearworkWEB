/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useRef, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import 'react-day-picker/dist/style.css'
import { DayPicker, DateRange } from 'react-day-picker'

import LoginCharts from '@/components/AdminComponents/AdminAnalytics/LoginCharts'

function formatMonthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  return d.toLocaleString('default', { month: 'long', year: 'numeric' })
}

// Returns { monday, sunday } around a single date
function weekRangeAround(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - ((day + 6) % 7))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (dt: Date) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
  return { monday: fmt(monday), sunday: fmt(sunday) }
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(false)

  // Filter state
  const [mode, setMode] = useState<'month' | 'custom'>('month')
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>(undefined)

  // Dropdown / picker open states
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false)
  const [customDropdownOpen, setCustomDropdownOpen] = useState(false)

  const monthRef = useRef<HTMLDivElement | null>(null)
  const customRef = useRef<HTMLDivElement | null>(null)

  // Close dropdowns/pickers on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (monthRef.current && !monthRef.current.contains(target)) setMonthDropdownOpen(false)
      if (customRef.current && !customRef.current.contains(target)) setCustomDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
        body: JSON.stringify({ targetDate: new Date().toISOString().slice(0, 10) }),
      })
      const data = await res.json()
      console.log('Analytics refreshed:', data)
    } catch (err) {
      console.error('Failed to refresh analytics:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleMonthSelect = (ym: string) => {
    setSelectedMonth(ym)
    setSelectedRange(undefined)
    setMonthDropdownOpen(false)
    setCustomDropdownOpen(false)
  }

  // Precompute month options (last 12 months)
  const monthOptions = (() => {
    const out: string[] = []
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      out.push(d.toISOString().slice(0, 7))
    }
    return out
  })()

  // Compute start/end dates for HourlyLoginChart
  const hourlyStartDate = selectedRange?.from
    ? selectedRange.from.toISOString().slice(0, 10)
    : `${selectedMonth}-01`

  const hourlyEndDate = selectedRange?.to
    ? selectedRange.to.toISOString().slice(0, 10)
    : (() => {
        const [y, m] = selectedMonth.split('-').map(Number)
        return `${selectedMonth}-${new Date(y, m, 0).getDate()}`
      })()

  const targetDate = selectedRange?.from && !selectedRange.to ? selectedRange.from.toISOString().slice(0, 10) : ''

  let weeklyStartDate: string
  let weeklyEndDate: string

  if (selectedRange?.from && !selectedRange.to) {
    // single day selected -> expand to week
    const { monday, sunday } = weekRangeAround(selectedRange.from.toISOString().slice(0, 10))
    weeklyStartDate = monday
    weeklyEndDate = sunday
  } else if (selectedRange?.from && selectedRange.to) {
    // range selected -> use exact range
    weeklyStartDate = selectedRange.from.toISOString().slice(0, 10)
    weeklyEndDate = selectedRange.to.toISOString().slice(0, 10)
  } else {
    // month mode or nothing selected -> full month
    const [y, m] = selectedMonth.split('-').map(Number)
    weeklyStartDate = `${selectedMonth}-01`
    weeklyEndDate = `${selectedMonth}-${new Date(y, m, 0).getDate()}`
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen flex flex-col p-6 text-[var(--foreground)] bg-gradient-to-br from-[#101312] via-[#1a1f1b] to-[#2e3b2b] gap-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-[var(--highlight)] mb-4">Analytics</h1>

        {/* Filter bar */}
        <div className="sticky top-0 z-20 bg-[#1f2420] p-3 border-b border-[#55694b] flex items-center gap-2 rounded-xl shadow-md">
          <h2 className="text-lg font-medium text-[var(--foreground)]">Filters</h2>

          <div className="flex items-center gap-2 ml-4 relative">
            {/* Month dropdown */}
            <div className="relative" ref={monthRef}>
              <button
                onClick={() => {
                  setMode('month')
                  setMonthDropdownOpen((p) => !p)
                  setCustomDropdownOpen(false)
                }}
                className={`px-3 py-1 rounded-md border text-sm font-medium ${
                  mode === 'month'
                    ? 'bg-[var(--accent-3)] border-[var(--accent-3)] text-[var(--text-bright)]'
                    : 'bg-[var(--accent-1)] border-[var(--accent-2)] text-[var(--text-bright)]'
                }`}
              >
                {formatMonthLabel(selectedMonth)}
              </button>

              {monthDropdownOpen && (
                <div className="absolute top-10 left-0 z-30 bg-[#1f2420] border border-white/10 rounded-2xl shadow-xl p-2 w-[220px]">
                  <div className="text-xs text-[#bdbdbd] mb-2 px-1">Select month</div>
                  <div className="max-h-56 overflow-auto">
                    {monthOptions.map((m) => (
                      <button
                        key={m}
                        onClick={() => handleMonthSelect(m)}
                        className={`w-full text-left px-3 py-2 rounded-md mb-1 text-sm transition-colors ${
                          m === selectedMonth
                            ? 'bg-[var(--accent-3)] text-[var(--text-bright)]'
                            : 'hover:bg-white/5 text-[var(--foreground)]'
                        }`}
                      >
                        {formatMonthLabel(m)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Custom button & DayPicker dropdown */}
            <div className="relative" ref={customRef}>
              <button
                onClick={() => {
                  setMode('custom')
                  setCustomDropdownOpen((p) => !p)
                  setMonthDropdownOpen(false)
                }}
                className={`px-3 py-1 rounded-md border text-sm font-medium ${
                  mode === 'custom'
                    ? 'bg-[var(--accent-3)] border-[var(--accent-3)] text-[var(--text-bright)]'
                    : 'bg-[var(--accent-1)] border-[var(--accent-2)] text-[var(--text-bright)]'
                }`}
              >
                Custom
              </button>

              {customDropdownOpen && (
                <div className="absolute top-10 left-0 z-30">
                  <div className="bg-[#151515] border border-white/10 rounded-2xl shadow-xl p-3">
                    <div className="flex justify-between items-center mb-2">
                      <div className="text-sm text-[#d1e2c5] font-semibold">Pick date range</div>
                      <button
                        onClick={() => setCustomDropdownOpen(false)}
                        className="text-sm px-2 py-1 rounded bg-transparent hover:bg-white/5"
                        title="Close"
                      >
                        ✕
                      </button>
                    </div>

                    <DayPicker
                      mode="range"
                      selected={selectedRange}
                      onSelect={(range) => setSelectedRange(range)}
                      weekStartsOn={1}
                      showOutsideDays
                      modifiersClassNames={{ today: 'rdp-day_today-custom' }}
                      modifiersStyles={{
                        selected: { color: '#F1F5E9', fontWeight: 'bold', background: 'var(--accent-3)' },
                        range_start: { background: 'var(--accent-3)', color: '#F1F5E9', borderRadius: '0.5rem 0 0 0.5rem' },
                        range_end: { background: 'var(--accent-3)', color: '#F1F5E9', borderRadius: '0 0.5rem 0.5rem 0' },
                        range_middle: { background: 'var(--accent-3)', color: '#F1F5E9' },
                      }}
                      className="
                        bg-transparent text-xs
                        [&_.rdp-day]:text-white [&_.rdp-day]:px-0.5 [&_.rdp-day]:py-0.25 [&_.rdp-day]:min-w-[1.5rem] [&_.rdp-day]:min-h-[1.5rem]
                        [&_.rdp-day--outside]:text-gray-500 [&_.rdp-day--outside]:opacity-50
                        [&_.rdp-day_today-custom]:!bg-lime-400/20 [&_.rdp-day_today-custom]:!text-lime-400 [&_.rdp-day_today-custom]:!font-bold [&_.rdp-day_today-custom]:!ring-2 [&_.rdp-day_today-custom]:!ring-lime-400 [&_.rdp-day_today-custom]:!rounded-full
                        [&_.rdp-day--disabled]:!text-gray-800 [&_.rdp-day--disabled]:!bg-[#101210] [&_.rdp-day--disabled]:!cursor-not-allowed [&_.rdp-day--disabled]:!opacity-100
                        [&_.rdp-caption]:text-white [&_.rdp-caption]:font-semibold
                        [&_.rdp-nav-button]:bg-transparent [&_.rdp-nav-button]:hover:bg-white/10 [&_.rdp-nav-button]:text-white [&_.rdp-nav-button]:p-1 [&_.rdp-nav-button]:rounded-full
                        [&_.rdp-nav-icon]:stroke-white
                        [&_.rdp-day:hover]:bg-white/10
                      "
                      disabled={{ after: new Date() }}
                      style={{ ['--rdp-accent-color' as any]: '#4d7c0f' }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1" />
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="px-4 py-1 rounded-full bg-[var(--accent-3)] hover:bg-[var(--accent-4)] text-[var(--text-bright)] font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Charts */}
        <div className="flex flex-row gap-6">
          <div className="w-1/2 bg-white/10 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl p-4 relative min-h-[300px]">
            <LoginCharts startDate={hourlyStartDate} endDate={hourlyEndDate} targetDate={targetDate} />
          </div>
          <div className="w-1/2 bg-white/10 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl p-4 relative min-h-[300px]">
            <LoginCharts startDate={hourlyStartDate} endDate={hourlyEndDate} targetDate={targetDate} />
          </div>
        </div>
      </div>
    </>
  )
}
