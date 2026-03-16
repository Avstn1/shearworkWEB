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

        const { data: rows, error } = await supabase.rpc('get_revenue_by_weekday', {
          p_user_id: userId,
          p_year: year,
          p_start_month: startMonth,
          p_end_month: endMonth,
        })

        if (error) throw error

        const totals: Record<string, number> = {}
        WEEKDAY_ORDER.forEach((d) => {
          totals[d] = 0
        })

        ;(rows ?? []).forEach((r: any) => {
          const weekday = r.weekday.trim()
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
    <div
      className="flex flex-col flex-1"
      style={{
        minHeight: '300px',
      }}
    >
      <h2 className="text-white text-xl font-semibold mb-4">{title}</h2>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[#555]">Loading chart...</p>
        </div>
      ) : (
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.04)"
              />
              <XAxis
                dataKey="weekday"
                tick={{ fill: '#8a9b90', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#8a9b90', fontSize: 12 }}
                tickFormatter={(val) => `$${val}`}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Revenue']}
                contentStyle={{
                  backgroundColor: '#0f1210',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  color: '#ffffff',
                }}
                itemStyle={{ color: 'rgba(255,255,255,0.5)' }}
                labelStyle={{ color: '#ffffff' }}
              />
              <Bar
                dataKey="total_revenue"
                name="Revenue"
                fill="#6ee7b7"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}