/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import Navbar from '@/components/Navbar'
import 'react-day-picker/dist/style.css'
import { DayPicker, DateRange } from 'react-day-picker'

import LoginCharts from '@/components/AdminComponents/AdminAnalytics/LoginCharts'
import NavCharts from '@/components/AdminComponents/AdminAnalytics/NavCharts'
import MonthlyReportCharts from '@/components/AdminComponents/AdminAnalytics/MonthlyReportCharts'
import FinanceCharts from '@/components/AdminComponents/AdminAnalytics/FinanceCharts'
import AggregateCharts from '@/components/AdminComponents/AdminAnalytics/AggregateCharts'

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number = 1) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
}

function formatMonthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  return d.toLocaleString('default', { month: 'long', year: 'numeric' })
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(false)

  // Filter state
  const [mode, setMode] = useState<'month' | 'custom'>('month')
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>(undefined)

  // Chart display modes
  const [viewMode, setViewMode] = useState<'hourly' | 'weekly'>('hourly')
  const [displayMode, setDisplayMode] = useState<'separate' | 'aggregate'>('separate')
  const [showAllLogs, setShowAllLogs] = useState(false)

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

  // Compute start/end dates for charts
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

  const cardClass = 'bg-white/10 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl p-4 relative min-h-[300px]'

  return (
    <>
      <div className="min-h-screen flex flex-col p-4 sm:p-6 text-[var(--foreground)] pt-[120px] bg-gradient-to-br from-[#101312] via-[#1a1f1b] to-[#2e3b2b] gap-6">
        
        {/* Header */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="mb-2 mt-4"
        >
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-amber-200 to-lime-300 bg-clip-text text-transparent animate-gradient">
            Analytics Dashboard
          </h1>
        </motion.div>

        {/* Filter bar */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          custom={1}
          className="sticky top-[100px] z-20 bg-[#1f2420]/95 backdrop-blur-md p-3 sm:p-4 border border-[#55694b]/50 flex flex-col lg:flex-row items-start lg:items-center gap-3 rounded-2xl shadow-2xl"
        >
          {/* Filters Label */}
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 bg-gradient-to-b from-lime-400 to-emerald-500 rounded-full" />
            <h2 className="text-base sm:text-lg font-semibold text-[var(--foreground)]">Filters</h2>
          </div>

          {/* Date Selection */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Month dropdown */}
            <div className="relative" ref={monthRef}>
              <button
                onClick={() => {
                  setMode('month')
                  setMonthDropdownOpen((p) => !p)
                  setCustomDropdownOpen(false)
                }}
                className={`px-3 sm:px-4 py-2 rounded-xl border text-sm font-medium transition-all duration-300 ${
                  mode === 'month'
                    ? 'bg-lime-300 border-lime-400 text-black shadow-[0_0_12px_rgba(196,255,133,0.5)]'
                    : 'bg-[#2a2a2a] border-[#3a3a3a] text-white hover:bg-[#3a3a3a]'
                }`}
              >
                {formatMonthLabel(selectedMonth)}
              </button>

              {monthDropdownOpen && (
                <div className="absolute top-12 left-0 z-30 bg-[#1f2420] border border-white/10 rounded-2xl shadow-2xl p-3 w-[220px] backdrop-blur-lg">
                  <div className="text-xs text-[#bdbdbd] mb-2 px-1 font-medium">Select month</div>
                  <div className="max-h-56 overflow-auto scrollbar-thin scrollbar-thumb-[#55694b] scrollbar-track-transparent">
                    {monthOptions.map((m) => (
                      <button
                        key={m}
                        onClick={() => handleMonthSelect(m)}
                        className={`w-full text-left px-3 py-2 rounded-xl mb-1 text-sm transition-all duration-200 ${
                          m === selectedMonth
                            ? 'bg-lime-300/20 text-lime-300 font-semibold'
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
                className={`px-3 sm:px-4 py-2 rounded-xl border text-sm font-medium transition-all duration-300 ${
                  mode === 'custom'
                    ? 'bg-sky-300 border-sky-400 text-black shadow-[0_0_12px_rgba(127,217,255,0.5)]'
                    : 'bg-[#2a2a2a] border-[#3a3a3a] text-white hover:bg-[#3a3a3a]'
                }`}
              >
                Custom Range
              </button>

              {customDropdownOpen && (
                <div className="absolute top-12 left-0 z-30">
                  <div className="bg-[#151515] border border-white/10 rounded-2xl shadow-2xl p-4 backdrop-blur-lg">
                    <div className="flex justify-between items-center mb-3">
                      <div className="text-sm text-[#d1e2c5] font-semibold">Pick date range</div>
                      <button
                        onClick={() => setCustomDropdownOpen(false)}
                        className="text-sm px-2 py-1 rounded-lg bg-transparent hover:bg-white/10 transition-colors"
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
                      className="bg-transparent text-xs"
                      disabled={{ after: new Date() }}
                      style={{ ['--rdp-accent-color' as any]: '#4d7c0f' }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Separator */}
          <div className="hidden lg:block h-8 w-px bg-gradient-to-b from-transparent via-[#55694b] to-transparent" />

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm text-[var(--foreground)] opacity-70 font-medium">View:</span>
            <div className="flex gap-1 bg-[#2a2a2a] p-1 rounded-xl">
              <button
                onClick={() => setViewMode('hourly')}
                className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-300 ${
                  viewMode === 'hourly'
                    ? 'bg-green-400 text-green-900 shadow-[0_0_8px_rgba(74,222,128,0.5)]'
                    : 'text-white/60 hover:text-white/80'
                }`}
              >
                Hourly
              </button>
              <button
                onClick={() => setViewMode('weekly')}
                className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-300 ${
                  viewMode === 'weekly'
                    ? 'bg-green-500 text-green-50 shadow-[0_0_8px_rgba(34,197,94,0.5)]'
                    : 'text-white/60 hover:text-white/80'
                }`}
              >
                Weekly
              </button>
            </div>
          </div>

          {/* Display Mode Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm text-[var(--foreground)] opacity-70 font-medium">Display:</span>
            <div className="flex gap-1 bg-[#2a2a2a] p-1 rounded-xl">
              <button
                onClick={() => setDisplayMode('separate')}
                className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-300 ${
                  displayMode === 'separate'
                    ? 'bg-blue-400 text-blue-900 shadow-[0_0_8px_rgba(96,165,250,0.5)]'
                    : 'text-white/60 hover:text-white/80'
                }`}
              >
                Separate
              </button>
              <button
                onClick={() => setDisplayMode('aggregate')}
                className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-300 ${
                  displayMode === 'aggregate'
                    ? 'bg-blue-500 text-blue-50 shadow-[0_0_8px_rgba(59,130,246,0.5)]'
                    : 'text-white/60 hover:text-white/80'
                }`}
              >
                Aggregate
              </button>
            </div>
          </div>

          {/* All Logs Toggle */}
          <button
            onClick={() => setShowAllLogs(!showAllLogs)}
            className={`px-3 sm:px-4 py-2 rounded-xl border text-xs sm:text-sm font-semibold transition-all duration-300 ${
              showAllLogs
                ? 'bg-purple-400 border-purple-500 text-purple-900 shadow-[0_0_12px_rgba(192,132,252,0.5)]'
                : 'bg-[#2a2a2a] border-[#3a3a3a] text-white hover:bg-[#3a3a3a]'
            }`}
          >
            All Logs
          </button>

          {/* Spacer */}
          <div className="flex-1 hidden lg:block" />
          
          {/* Refresh Button */}
          {/* <button
            onClick={handleRefresh}
            disabled={loading}
            className="whitespace-nowrap flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-lime-300 hover:bg-lime-400 text-black text-sm font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_12px_rgba(196,255,133,0.3)] hover:shadow-[0_0_16px_rgba(196,255,133,0.5)]"
          >
            <Loader2 className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button> */}
          <p className="italic text-gray-400">Will automatically refresh every 5 minutes</p>
        </motion.div>

        {/* Charts Grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${viewMode}-${displayMode}-${showAllLogs}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
            className={showAllLogs ? "flex flex-col gap-4 sm:gap-6" : "grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6"}
          >
            {showAllLogs && (
              /* Aggregate Chart - Full Width at Top */
              <motion.div 
                variants={fadeInUp} 
                custom={2} 
                className="bg-white/10 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl p-4 relative min-h-[300px]"
              >
                <AggregateCharts 
                  startDate={hourlyStartDate} 
                  endDate={hourlyEndDate} 
                  targetDate={targetDate}
                  viewMode={viewMode}
                />
              </motion.div>
            )}

            {/* Other Charts Grid */}
            <div className={showAllLogs 
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6" 
              : "contents"
            }>
              {/* Login Chart */}
              <motion.div 
                variants={fadeInUp} 
                custom={showAllLogs ? 3 : 2} 
                className={showAllLogs ? "bg-white/10 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl p-4 relative min-h-[250px]" : cardClass}
              >
                <LoginCharts 
                  startDate={hourlyStartDate} 
                  endDate={hourlyEndDate} 
                  targetDate={targetDate}
                  viewMode={viewMode}
                  displayMode={displayMode}
                />
              </motion.div>

              {/* Nav Chart */}
              <motion.div 
                variants={fadeInUp} 
                custom={showAllLogs ? 4 : 3} 
                className={showAllLogs ? "bg-white/10 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl p-4 relative min-h-[250px]" : cardClass}
              >
                <NavCharts 
                  startDate={hourlyStartDate} 
                  endDate={hourlyEndDate} 
                  targetDate={targetDate}
                  viewMode={viewMode}
                  displayMode={displayMode}
                />
              </motion.div>

              {/* Monthly Report Chart */}
              <motion.div 
                variants={fadeInUp} 
                custom={showAllLogs ? 5 : 4} 
                className={showAllLogs ? "bg-white/10 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl p-4 relative min-h-[250px]" : cardClass}
              >
                <MonthlyReportCharts 
                  startDate={hourlyStartDate} 
                  endDate={hourlyEndDate} 
                  targetDate={targetDate}
                  viewMode={viewMode}
                  displayMode={displayMode}
                />
              </motion.div>

              {/* Finance Chart */}
              <motion.div 
                variants={fadeInUp} 
                custom={showAllLogs ? 6 : 5} 
                className={showAllLogs ? "bg-white/10 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl p-4 relative min-h-[250px]" : cardClass}
              >
                <FinanceCharts 
                  startDate={hourlyStartDate} 
                  endDate={hourlyEndDate} 
                  targetDate={targetDate}
                  viewMode={viewMode}
                  displayMode={displayMode}
                />
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  )
}