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

  const item = 'segmented-item px-2.5 py-1 text-xs'

  return (
    <div className="relative flex h-[300px] flex-col">
      <div className="segmented absolute right-0 top-[-4px] z-10" role="tablist" aria-label="Group revenue by">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'weekday'}
          data-active={view === 'weekday'}
          onClick={() => setView('weekday')}
          className={item}
        >
          Day
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'month'}
          data-active={view === 'month'}
          onClick={() => setView('month')}
          className={item}
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
