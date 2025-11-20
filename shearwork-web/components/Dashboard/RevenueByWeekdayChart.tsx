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

const JS_WEEKDAY = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

function getDateRange(timeframe: Timeframe, year: number) {
  switch (timeframe) {
    case 'Q1':
      return { start: `${year}-01-01`, end: `${year}-03-31` }
    case 'Q2':
      return { start: `${year}-04-01`, end: `${year}-06-30` }
    case 'Q3':
      return { start: `${year}-07-01`, end: `${year}-09-30` }
    case 'Q4':
      return { start: `${year}-10-01`, end: `${year}-12-31` }
    case 'year':
    default:
      return { start: `${year}-01-01`, end: `${year}-12-31` }
  }
}

export default function RevenueByWeekdayChart({ userId, year, timeframe }: Props) {
  const [data, setData] = useState<DayData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return

    const fetchData = async () => {
      setLoading(true)
      try {
        const { start, end } = getDateRange(timeframe, year)

        const { data: rows, error } = await supabase
          .from('daily_data')
          .select('date, final_revenue')
          .eq('user_id', userId)
          .gte('date', start)
          .lte('date', end)

        if (error) throw error

        // init totals
        const totals: Record<string, number> = {}
        WEEKDAY_ORDER.forEach((d) => (totals[d] = 0))

        ;(rows ?? []).forEach((r: any) => {
          const d = new Date(`${r.date}T00:00:00`)
          const jsName = JS_WEEKDAY[d.getDay()] // Sunday..Saturday
          const weekday =
            jsName === 'Sunday'
              ? 'Sunday'
              : WEEKDAY_ORDER.find((w) => w === jsName) ?? jsName

          if (!totals[weekday]) totals[weekday] = 0
          totals[weekday] += Number(r.final_revenue) || 0
        })

        const mapped: DayData[] = WEEKDAY_ORDER.map((weekday) => ({
          weekday,
          total_revenue: totals[weekday] || 0,
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
