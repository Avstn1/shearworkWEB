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

interface MonthData {
  month: string
  total_revenue: number
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function getMonthsForTimeframe(timeframe: Timeframe): string[] {
  switch (timeframe) {
    case 'Q1':
      return MONTHS.slice(0, 3) // Jan–Mar
    case 'Q2':
      return MONTHS.slice(3, 6) // Apr–Jun
    case 'Q3':
      return MONTHS.slice(6, 9) // Jul–Sep
    case 'Q4':
      return MONTHS.slice(9, 12) // Oct–Dec
    case 'year':
    default:
      return MONTHS
  }
}

export default function QuarterlyRevenueChart({ userId, year, timeframe }: Props) {
  const [data, setData] = useState<MonthData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return

    const fetchData = async () => {
      setLoading(true)
      try {
        const { data: rows, error } = await supabase
          .from('monthly_data')
          .select('month, final_revenue')
          .eq('user_id', userId)
          .eq('year', year)

        if (error) throw error

        // map all months to a fixed order with default 0
        const totals: Record<string, number> = {}
        MONTHS.forEach((m) => (totals[m] = 0))

        ;(rows ?? []).forEach((r: any) => {
          const name = r.month as string
          const monthName = MONTHS.find((m) => m === name) ?? name
          totals[monthName] += Number(r.final_revenue) || 0
        })

        const visibleMonths = getMonthsForTimeframe(timeframe)

        const mapped: MonthData[] = visibleMonths.map((m) => ({
          month: m,
          total_revenue: totals[m] || 0,
        }))

        setData(mapped)
      } catch (err) {
        console.error('Error fetching monthly revenue:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [userId, year, timeframe])

  const title =
    timeframe === 'year'
      ? '📊 Revenue by Month (Year)'
      : `📊 Revenue by Month (${timeframe})`

  return (
    <div className="h-[300px] flex flex-col">
      <h2 className="text-[#E8EDC7] text-base font-semibold mb-3">
        {title}
      </h2>
      {loading ? (
        <div className="text-[#F5E6C5] text-sm">Loading chart...</div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data.map((d) => ({
              label: d.month.slice(0, 3), // Jan, Feb, ...
              total_revenue: d.total_revenue,
            }))}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="label" tick={{ fill: '#d1e2c5', fontSize: 12 }} />
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
