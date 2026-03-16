'use client'

import React, { useState } from 'react'
import RevenueByWeekdayChart from './RevenueByWeekdayChart'
import QuarterlyRevenueChart from './QuarterlyRevenueChart'

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
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setView('weekday')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 ${
            view === 'weekday'
              ? 'bg-[rgba(167,139,250,0.18)] text-white border-[rgba(167,139,250,0.35)]'
              : 'bg-black/40 text-[#555] border-white/[0.06] hover:bg-[rgba(167,139,250,0.1)] hover:text-[#a78bfa]'
          }`}
        >
          Day
        </button>
        <button
          type="button"
          onClick={() => setView('month')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 ${
            view === 'month'
              ? 'bg-[rgba(167,139,250,0.18)] text-white border-[rgba(167,139,250,0.35)]'
              : 'bg-black/40 text-[#555] border-white/[0.06] hover:bg-[rgba(167,139,250,0.1)] hover:text-[#a78bfa]'
          }`}
        >
          Month
        </button>
      </div>

      {view === 'weekday' ? (
        <RevenueByWeekdayChart
          userId={userId}
          year={year}
          timeframe={timeframe}
        />
      ) : (
        <QuarterlyRevenueChart
          userId={userId}
          year={year}
          timeframe={timeframe}
        />
      )}
    </div>
  )
}