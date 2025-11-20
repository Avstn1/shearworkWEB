'use client'

import React, { useState } from 'react'
import RevenueByWeekdayChart from './RevenueByWeekdayChart'
import QuarterlyRevenueChart from './QuarterlyRevenueChart'  // <- your month chart

type Timeframe = 'year' | 'Q1' | 'Q2' | 'Q3' | 'Q4'

interface Props {
  userId: string
  year: number
  timeframe: Timeframe
}

type ViewMode = 'weekday' | 'month'

export default function RevenueDayMonthToggleChart({
  userId,
  year,
  timeframe,
}: Props) {
  const [view, setView] = useState<ViewMode>('weekday')

  return (
    <div className="relative h-[300px] flex flex-col">
      {/* Toggle buttons */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setView('weekday')}
          className={`px-2 py-1 rounded-full text-xs font-semibold border transition-colors ${
            view === 'weekday'
              ? 'bg-lime-300 text-black border-lime-300 shadow-[0_0_8px_#c4ff85]'
              : 'bg-black/40 text-[#d1e2c5] border-white/20 hover:bg-white/10'
          }`}
        >
          Day
        </button>
        <button
          type="button"
          onClick={() => setView('month')}
          className={`px-2 py-1 rounded-full text-xs font-semibold border transition-colors ${
            view === 'month'
              ? 'bg-lime-300 text-black border-lime-300 shadow-[0_0_8px_#c4ff85]'
              : 'bg-black/40 text-[#d1e2c5] border-white/20 hover:bg-white/10'
          }`}
        >
          Month
        </button>
      </div>

      {/* Underlying chart – re-use your existing components */}
      {view === 'weekday' ? (
        <RevenueByWeekdayChart
          userId={userId}
          year={year}
          timeframe={timeframe} // you already added this prop earlier
        />
      ) : (
        <QuarterlyRevenueChart
          userId={userId}
          year={year}
          timeframe={timeframe} // acts as "month" chart based on timeframe
        />
      )}
    </div>
  )
}
