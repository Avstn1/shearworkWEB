'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import YearlyRevenueCard from '@/components/Dashboard/YearlyRevenueCard'
import YearlyExpensesCard from './YearlyExpensesCard'
import YearlyTopClientsCard from './YearlyTopClientsCard'
import TimeframeAverageTicketCard from './TimeframeAverageTicketCard'
import RevenueDayMonthToggleChart from './RevenueDayMonthToggleChart'
import YearlyServiceBreakdownChart from './YearlyServiceBreakdownChart'
import TimeframeMarketingFunnelsChart from './TimeframeMarketingFunnelsChart'
import { useIsMobile } from '@/hooks/useIsMobile'
import { Segmented } from '@/components/ui/AppKit'
import toast from 'react-hot-toast'

interface YearlyDashboardProps {
  userId: string
  selectedYear: number
  globalRefreshKey: number
}

type Timeframe = 'year' | 'Q1' | 'Q2' | 'Q3' | 'Q4'

const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  year: 'Year',
  Q1: 'Q1 (Jan–Mar)',
  Q2: 'Q2 (Apr–Jun)',
  Q3: 'Q3 (Jul–Sep)',
  Q4: 'Q4 (Oct–Dec)',
}

const TIMEFRAME_OPTIONS: Array<{ value: Timeframe; label: React.ReactNode }> = [
  { value: 'year', label: 'Year' },
  { value: 'Q1', label: 'Q1' },
  { value: 'Q2', label: 'Q2' },
  { value: 'Q3', label: 'Q3' },
  { value: 'Q4', label: 'Q4' },
]

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number = 1) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
}

export default function YearlyDashboard({
  userId,
  selectedYear,
  globalRefreshKey,
}: YearlyDashboardProps) {
  const isMobile = useIsMobile(768)
  const [timeframe, setTimeframe] = useState<Timeframe>('year')

  const statClass = 'panel flex flex-col p-4 sm:p-5'
  const cardClass = 'panel flex flex-1 flex-col p-4 sm:p-5'

  useEffect(() => {
    if (!userId) return
  },[selectedYear, timeframe])

  return (
    <motion.div className="flex flex-1 flex-col gap-4">
      {/* Timeframe selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Showing <span className="font-medium text-ivory">{TIMEFRAME_LABELS[timeframe]}</span> {selectedYear}
        </p>
        <Segmented
          options={TIMEFRAME_OPTIONS}
          value={timeframe}
          onChange={setTimeframe}
          className="w-full sm:w-auto"
        />
      </div>

      {/* TOP ROW: Revenue / Expenses / Avg Ticket */}
      <motion.div variants={fadeInUp} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <motion.div className={statClass}>
          <YearlyRevenueCard
            key={`yrevenue-${globalRefreshKey}-${timeframe}`}
            userId={userId}
            year={selectedYear}
            timeframe={timeframe}
          />
        </motion.div>

        <motion.div className={statClass}>
          <YearlyExpensesCard
            key={`yexpenses-${globalRefreshKey}-${timeframe}`}
            userId={userId}
            year={selectedYear}
            timeframe={timeframe}
          />
        </motion.div>

        <motion.div className={statClass}>
          <TimeframeAverageTicketCard
            key={`yavg-${globalRefreshKey}-${timeframe}`}
            userId={userId}
            year={selectedYear}
            timeframe={timeframe}
          />
        </motion.div>
      </motion.div>

      {/* MIDDLE ROW: Day/Month toggle chart + Top Clients */}
      <motion.div variants={fadeInUp} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <motion.div className={cardClass}>
          <RevenueDayMonthToggleChart
            key={`ydaymonth-${globalRefreshKey}-${timeframe}`}
            userId={userId}
            year={selectedYear}
            timeframe={timeframe}
          />
        </motion.div>

        <motion.div className={cardClass}>
          <YearlyTopClientsCard
            key={`ytopclients-${globalRefreshKey}-${timeframe}`}
            userId={userId}
            year={selectedYear}
            timeframe={timeframe}
          />
        </motion.div>
      </motion.div>

      {/* BOTTOM ROW: Service Breakdown + Marketing Funnels */}
      <motion.div variants={fadeInUp} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <motion.div className={cardClass}>
          <YearlyServiceBreakdownChart
            key={`yservices-${globalRefreshKey}-${timeframe}`}
            barberId={userId}
            year={selectedYear}
            timeframe={timeframe}
          />
        </motion.div>

        <motion.div className={cardClass}>
          <TimeframeMarketingFunnelsChart
            key={`yfunnels-${globalRefreshKey}-${timeframe}`}
            barberId={userId}
            year={selectedYear}
            timeframe={timeframe}
          />
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
