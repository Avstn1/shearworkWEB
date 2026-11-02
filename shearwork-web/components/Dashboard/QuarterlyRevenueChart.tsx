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
        // Call RPC function to get revenue by month (includes tips)
        const { data: rows, error } = await supabase.rpc('get_revenue_by_month', {
          p_user_id: userId,
          p_year: year,
        })

        if (error) throw error

        // Map all months to a fixed order with default 0
        const totals: Record<string, number> = {}
        MONTHS.forEach((m) => (totals[m] = 0))

        ;(rows ?? []).forEach((r: any) => {
          // month_name comes with padding from TO_CHAR, e.g. "January  "
          const monthName = r.month_name.trim()
          if (totals[monthName] !== undefined) {
            totals[monthName] = r.total_revenue || 0
          }
        })

        const visibleMonths = getMonthsForTimeframe(timeframe)

        const mapped: MonthData[] = visibleMonths.map((m) => ({
          month: m,
          total_revenue: Math.round((totals[m] || 0) * 100) / 100,
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
      ? 'Revenue by Month (Year)'
      : `Revenue by Month (${timeframe})`

  return (
    <div className="flex h-[300px] flex-col">
      <h2 className="panel-title mb-4">{title}</h2>
      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-gray-500">Loading chart…</div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data.map((d) => ({
              label: d.month.slice(0, 3), // Jan, Feb, ...
              total_revenue: d.total_revenue,
            }))}
            margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
          >
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#7C817A', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: '#7C817A', fontSize: 11 }}
              tickFormatter={(val) => `$${val}`}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Revenue']}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              contentStyle={{
                backgroundColor: '#1D201E',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                color: '#ECEDEA',
                fontSize: 12,
              }}
              itemStyle={{ color: '#ECEDEA' }}
              labelStyle={{ color: '#9EA39C', fontWeight: 600 }}
            />
            <Bar
              dataKey="total_revenue"
              name="Revenue"
              fill="#8CC470"
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
