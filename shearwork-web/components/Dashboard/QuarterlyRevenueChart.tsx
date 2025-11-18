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

interface Props {
  userId: string
  year: number
}

interface QuarterData {
  quarter: number
  total_revenue: number
}

const QUARTER_LABELS: Record<number, string> = {
  1: 'Q1',
  2: 'Q2',
  3: 'Q3',
  4: 'Q4',
}

export default function QuarterlyRevenueChart({ userId, year }: Props) {
  const [data, setData] = useState<QuarterData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return

    const fetchData = async () => {
      setLoading(true)
      try {
        const { data: rows, error } = await supabase
          .from('quarterly_revenue_summary')
          .select('quarter, total_revenue')
          .eq('user_id', userId)
          .eq('year', year)

        if (error) throw error

        const mapped: QuarterData[] = (rows ?? [])
          .map((r: any) => ({
            quarter: r.quarter,
            total_revenue: Number(r.total_revenue) || 0,
          }))
          .sort((a, b) => a.quarter - b.quarter)

        setData(mapped)
      } catch (err) {
        console.error('Error fetching quarterly revenue:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [userId, year])

  return (
    <div className="h-[300px] flex flex-col">
      <h2 className="text-[#E8EDC7] text-base font-semibold mb-3">
        📊 Revenue by Quarter
      </h2>
      {loading ? (
        <div className="text-[#F5E6C5] text-sm">Loading chart...</div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data.map((d) => ({
              label: QUARTER_LABELS[d.quarter] ?? `Q${d.quarter}`,
              total_revenue: d.total_revenue,
            }))}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis
              dataKey="label"
              tick={{ fill: '#d1e2c5', fontSize: 12 }}
            />
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
