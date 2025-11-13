'use client'

import React, { useEffect, useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts'
import { supabase } from '@/utils/supabaseClient'

interface DailyData {
  date: string
  final_revenue: number
  expenses: number
}

interface ProfitLossTrendChartProps {
  userId: string
  selectedMonth: string
  selectedYear: number
}

export default function ProfitLossTrendChart({
  userId,
  selectedMonth,
  selectedYear,
}: ProfitLossTrendChartProps) {
  const [data, setData] = useState<
    { date: string; revenue: number; expenses: number; profit: number }[]
  >([])

  useEffect(() => {
    const fetchData = async () => {
      if (!userId || !selectedMonth || !selectedYear) return

      const { data: daily, error } = await supabase
        .from('daily_data')
        .select('date, final_revenue, expenses')
        .eq('user_id', userId)
        .eq('month', selectedMonth)
        .eq('year', selectedYear)
        .order('date', { ascending: true })

      if (error) {
        console.error('❌ Error fetching daily data:', error)
        return
      }

      if (!daily || daily.length === 0) {
        setData([])
        return
      }

      const today = new Date()

      const formatted = daily
        .filter((d) => {
          const dateObj = new Date(d.date + 'T00:00:00Z')
          // Only include dates up to today
          return dateObj <= today
        })
        .map((d) => {
          const revenue = Number(d.final_revenue || 0)
          const expenses = Number(d.expenses || 0)
          const profit = revenue - expenses
          const dateLabel = new Date(d.date + 'T00:00:00Z').getUTCDate().toString()

          return {
            date: dateLabel,
            revenue,
            expenses,
            profit,
          }
        })

      setData(formatted)
    }

    fetchData()
  }, [userId, selectedMonth, selectedYear])

  if (data.length === 0) {
    return (
      <div
        className="p-4 rounded-lg shadow-md border flex items-center justify-center min-h-[200px]"
        style={{
          borderColor: 'var(--card-revenue-border)',
          background: 'var(--card-revenue-bg)',
        }}
      >
        <p className="text-[#E8EDC7] opacity-70 text-sm">
          No daily data yet for {selectedMonth}
        </p>
      </div>
    )
  }

  return (
    <div className="w-full h-64">
      <h2 className="text-[#c4d2b8] font-semibold mb-2 text-sm sm:text-lg">
        Profit/Loss Trend (Daily)
      </h2>

      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            dataKey="date"
            stroke="#ccc"
            label={{
              value: 'Day of Month',
              position: 'insideBottom',
              offset: -5,
              fill: '#ccc',
              fontSize: 12,
            }}
          />
          <YAxis stroke="#ccc" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#2b2b2b',
              border: '1px solid #C8B653',
              borderRadius: '8px',
              color: '#F5F5DC',
            }}
            itemStyle={{ color: '#E8EDC7' }}
            formatter={(value: number, name: string) => {
              let label = ''
              switch (name) {
                case 'revenue':
                  label = 'Revenue'
                  break
                case 'expenses':
                  label = 'Expenses'
                  break
                case 'profit':
                  label = 'Profit'
                  break
                default:
                  label = name
              }
              return [`$${value.toFixed(2)}`, label]
            }}
          />

          <Legend />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#aeea00"
            strokeWidth={2}
            name="Revenue"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="expenses"
            stroke="#ff6d00"
            strokeWidth={2}
            name="Expenses"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="profit"
            stroke="#00e676"
            strokeWidth={2}
            name="Profit"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
