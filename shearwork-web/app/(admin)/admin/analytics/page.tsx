/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, CalendarDays, X, BarChart3 } from 'lucide-react'
import { AppPage, PageHeader, Segmented } from '@/components/ui/AppKit'
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
    transition: { delay: i * 0.05, duration: 0.3 },
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

  const cardClass = 'panel p-4 relative min-h-[300px]'
  const compactCardClass = 'panel p-4 relative min-h-[250px]'

  return (
    <AppPage>
      {/* Header */}
      <motion.div variants={fadeInUp} initial="hidden" animate="visible">
        <PageHeader icon={BarChart3} tone="sky" title="Analytics" subtitle="Logins, navigation, reports and finance activity across the app." />
      </motion.div>

      {/* Filter bar */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        custom={1}
        className="panel sticky top-[calc(var(--navbar-height,72px)+0.5rem)] z-20 mb-4 flex flex-col items-start gap-3 p-3 lg:flex-row lg:items-center"
      >
        {/* Date Selection */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="stat-label mr-1">Range</span>
          <div className="segmented">
            {/* Month dropdown */}
            <div className="relative" ref={monthRef}>
              <button
                type="button"
                data-active={mode === 'month'}
                onClick={() => {
                  setMode('month')
                  setMonthDropdownOpen((p) => !p)
                  setCustomDropdownOpen(false)
                }}
                className="segmented-item inline-flex items-center gap-1.5"
              >
                <CalendarDays size={14} strokeWidth={1.75} />
                {formatMonthLabel(selectedMonth)}
              </button>

              {monthDropdownOpen && (
                <div className="modal-surface absolute left-0 top-11 z-30 w-[220px] p-2">
                  <div className="field-label px-2 pt-1">Select month</div>
                  <div className="max-h-56 overflow-auto">
                    {monthOptions.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleMonthSelect(m)}
                        className={`mb-0.5 w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                          m === selectedMonth
                            ? 'bg-white/[0.06] font-medium text-sage-bright'
                            : 'text-gray-300 hover:bg-white/[0.04] hover:text-ivory'
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
                type="button"
                data-active={mode === 'custom'}
                onClick={() => {
                  setMode('custom')
                  setCustomDropdownOpen((p) => !p)
                  setMonthDropdownOpen(false)
                }}
                className="segmented-item"
              >
                Custom range
              </button>

              {customDropdownOpen && (
                <div className="absolute left-0 top-11 z-30">
                  <div className="modal-surface p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm font-semibold text-ivory">Pick date range</div>
                      <button
                        type="button"
                        onClick={() => setCustomDropdownOpen(false)}
                        className="btn btn-ghost btn-sm !h-8 !w-8 !p-0"
                        title="Close"
                        aria-label="Close"
                      >
                        <X size={16} strokeWidth={1.75} />
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
                        selected: { color: '#111312', fontWeight: 600, background: '#8FB57A' },
                        range_start: { background: '#8FB57A', color: '#111312', borderRadius: '0.375rem 0 0 0.375rem' },
                        range_end: { background: '#8FB57A', color: '#111312', borderRadius: '0 0.375rem 0.375rem 0' },
                        range_middle: { background: 'rgba(143,181,122,0.18)', color: '#ECEDEA' },
                      }}
                      className="bg-transparent text-xs text-gray-300"
                      disabled={{ after: new Date() }}
                      style={{ ['--rdp-accent-color' as any]: '#8FB57A' }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="hidden h-6 w-px bg-white/[0.07] lg:block" />

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <span className="stat-label">View</span>
          <Segmented
            options={[
              { value: 'hourly', label: 'Hourly' },
              { value: 'weekly', label: 'Weekly' },
            ]}
            value={viewMode}
            onChange={setViewMode}
          />
        </div>

        {/* Display Mode Toggle */}
        <div className="flex items-center gap-2">
          <span className="stat-label">Display</span>
          <Segmented
            options={[
              { value: 'separate', label: 'Separate' },
              { value: 'aggregate', label: 'Aggregate' },
            ]}
            value={displayMode}
            onChange={setDisplayMode}
          />
        </div>

        {/* All Logs Toggle */}
        <button
          type="button"
          onClick={() => setShowAllLogs(!showAllLogs)}
          aria-pressed={showAllLogs}
          className={`btn btn-sm ${showAllLogs ? 'btn-bright' : 'btn-glass'}`}
        >
          All logs
        </button>

        {/* Spacer */}
        <div className="hidden flex-1 lg:block" />

        {/* Refresh Button (disabled; charts refresh themselves) */}
        {/* <button onClick={handleRefresh} disabled={loading} className="btn btn-glass btn-sm">
          <Loader2 className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
        </button> */}
        <p className="text-xs text-gray-500">Refreshes automatically every 5 minutes</p>
      </motion.div>

      {/* Charts Grid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${viewMode}-${displayMode}-${showAllLogs}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className={showAllLogs ? 'flex flex-col gap-4' : 'grid grid-cols-1 gap-4 lg:grid-cols-2'}
        >
          {showAllLogs && (
            /* Aggregate Chart - Full Width at Top */
            <motion.div variants={fadeInUp} custom={2} className={cardClass}>
              <AggregateCharts
                startDate={hourlyStartDate}
                endDate={hourlyEndDate}
                targetDate={targetDate}
                viewMode={viewMode}
              />
            </motion.div>
          )}

          {/* Other Charts Grid */}
          <div className={showAllLogs ? 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4' : 'contents'}>
            {/* Login Chart */}
            <motion.div variants={fadeInUp} custom={showAllLogs ? 3 : 2} className={showAllLogs ? compactCardClass : cardClass}>
              <LoginCharts
                startDate={hourlyStartDate}
                endDate={hourlyEndDate}
                targetDate={targetDate}
                viewMode={viewMode}
                displayMode={displayMode}
              />
            </motion.div>

            {/* Nav Chart */}
            <motion.div variants={fadeInUp} custom={showAllLogs ? 4 : 3} className={showAllLogs ? compactCardClass : cardClass}>
              <NavCharts
                startDate={hourlyStartDate}
                endDate={hourlyEndDate}
                targetDate={targetDate}
                viewMode={viewMode}
                displayMode={displayMode}
              />
            </motion.div>

            {/* Monthly Report Chart */}
            <motion.div variants={fadeInUp} custom={showAllLogs ? 5 : 4} className={showAllLogs ? compactCardClass : cardClass}>
              <MonthlyReportCharts
                startDate={hourlyStartDate}
                endDate={hourlyEndDate}
                targetDate={targetDate}
                viewMode={viewMode}
                displayMode={displayMode}
              />
            </motion.div>

            {/* Finance Chart */}
            <motion.div variants={fadeInUp} custom={showAllLogs ? 6 : 5} className={showAllLogs ? compactCardClass : cardClass}>
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
    </AppPage>
  )
}
