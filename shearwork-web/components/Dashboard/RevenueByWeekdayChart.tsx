'use client'

import React, { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { supabase } from '@/utils/supabaseClient'

type Timeframe = 'year' | 'Q1' | 'Q2' | 'Q3' | 'Q4'

interface Props {
  userId: string
  year: number
  timeframe: Timeframe
}

interface DayData {
  weekday: string
  total_revenue: number
}

const WEEKDAY_ORDER = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

// Month ranges for quarters
const QUARTER_MONTHS: Record<Timeframe, { startMonth: number; endMonth: number }> = {
  year: { startMonth: 1, endMonth: 12 },
  Q1: { startMonth: 1, endMonth: 3 },
  Q2: { startMonth: 4, endMonth: 6 },
  Q3: { startMonth: 7, endMonth: 9 },
  Q4: { startMonth: 10, endMonth: 12 },
}

export default function RevenueByWeekdayChart({ userId, year, timeframe }: Props) {
  const [data, setData] = useState<DayData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return

    const fetchData = async () => {
      setLoading(true)
      try {
        const { startMonth, endMonth } = QUARTER_MONTHS[timeframe]

        // Call RPC function to get revenue by weekday (includes tips)
        const { data: rows, error } = await supabase.rpc('get_revenue_by_weekday', {
          p_user_id: userId,
          p_year: year,
          p_start_month: startMonth,
          p_end_month: endMonth,
        })

        if (error) throw error

        // Build map from RPC results (weekday names come with padding from TO_CHAR)
        const totals: Record<string, number> = {}
        WEEKDAY_ORDER.forEach((d) => (totals[d] = 0))

        ;(rows ?? []).forEach((r: any) => {
          const weekday = r.weekday.trim() // Remove padding from TO_CHAR
          if (totals[weekday] !== undefined) {
            totals[weekday] = r.total_revenue || 0
          }
        })

        const mapped: DayData[] = WEEKDAY_ORDER.map((weekday) => ({
          weekday,
          total_revenue: Math.round((totals[weekday] || 0) * 100) / 100,
        }))

        setData(mapped)
      } catch (err) {
        console.error('Error fetching weekday revenues: ', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [userId, year, timeframe])

  const title =
    timeframe === 'year'
      ? '💵 Revenue by Weekday (Year)'
      : `💵 Revenue by Weekday (${timeframe})`

  return (
    <div className="h-[300px] flex flex-col">
      <h2 className="text-[#E8EDC7] text-base font-semibold mb-3">{title}</h2>
      {loading ? (
        <div className="text-[#F5E6C5] text-sm">Loading chart...</div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="weekday" tick={{ fill: '#d1e2c5', fontSize: 12 }} />
            <YAxis
              tick={{ fill: '#d1e2c5', fontSize: 12 }}
              tickFormatter={(val) => `$${val}`}
            />
            <Tooltip
              formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Revenue']}
              contentStyle={{
                backgroundColor: '#1a1f1b',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#F5E6C5',
              }}
            />
            <Bar
              dataKey="total_revenue"
              name="Revenue"
              fill="#c4ff85"
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}