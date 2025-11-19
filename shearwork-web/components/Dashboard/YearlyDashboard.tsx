'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import YearlyRevenueCard from '@/components/Dashboard/YearlyRevenueCard'
import YearlyExpensesCard from './YearlyExpensesCard'
import YearlyTopClientsCard from './YearlyTopClientsCard'
import TimeframeAverageTicketCard from './TimeframeAverageTicketCard'
import RevenueDayMonthToggleChart from './RevenueDayMonthToggleChart'
import { useIsMobile } from '@/hooks/useIsMobile'

interface YearlyDashboardProps {
  userId: string
  selectedYear: number
  globalRefreshKey: number
}

type Timeframe = 'year' | 'Q1' | 'Q2' | 'Q3' | 'Q4'

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

  const cardClass =
    'bg-white/10 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl p-4 flex flex-col flex-1'

  return (
    <motion.div className="flex flex-col gap-4 flex-1">
      <div className="flex flex-col gap-4 pr-1">
        {/* Timeframe selector */}
        <div className="flex justify-end">
          <label className="text-sm text-[#d1e2c5] flex items-center gap-2">
            <span>Timeline:</span>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as Timeframe)}
              className="bg-black/40 border border-white/20 rounded-full px-3 py-1 text-xs text-[#F5E6C5] focus:outline-none focus:ring-2 focus:ring-lime-300/60"
            >
              <option value="year">Year</option>
              <option value="Q1">Q1 (Jan–Mar)</option>
              <option value="Q2">Q2 (Apr–Jun)</option>
              <option value="Q3">Q3 (Jul–Sep)</option>
              <option value="Q4">Q4 (Oct–Dec)</option>
            </select>
          </label>
        </div>

        {/* TOP ROW: Revenue / Expenses / Avg Ticket */}
        <motion.div
          variants={fadeInUp}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          <motion.div className={cardClass}>
            <YearlyRevenueCard
              key={`yrevenue-${globalRefreshKey}-${timeframe}`}
              userId={userId}
              year={selectedYear}
              timeframe={timeframe}
            />
          </motion.div>

          <motion.div className={cardClass}>
            <YearlyExpensesCard
              key={`yexpenses-${globalRefreshKey}-${timeframe}`}
              userId={userId}
              year={selectedYear}
              timeframe={timeframe}
            />
          </motion.div>

          <motion.div className={cardClass}>
            <TimeframeAverageTicketCard
              key={`yavg-${globalRefreshKey}-${timeframe}`}
              userId={userId}
              year={selectedYear}
              timeframe={timeframe}
            />
          </motion.div>
        </motion.div>

        {/* MIDDLE ROW: Day/Month toggle chart + Top Clients */}
        <motion.div
          variants={fadeInUp}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          {/* Left: Revenue by Day / Month toggle */}
          <motion.div className={cardClass}>
            <RevenueDayMonthToggleChart
              key={`ydaymonth-${globalRefreshKey}-${timeframe}`}
              userId={userId}
              year={selectedYear}
              timeframe={timeframe}
            />
          </motion.div>

          {/* Right: Top clients for selected timeframe */}
          <motion.div className={cardClass}>
            <YearlyTopClientsCard
              key={`ytopclients-${globalRefreshKey}-${timeframe}`}
              userId={userId}
              year={selectedYear}
              timeframe={timeframe}
            />
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  )
}
