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
          const dateObj = new Date(d.date + 'T00:00:00')
          // Only include dates up to today
          return dateObj <= today
        })
        .map((d) => {
          const revenue = Number(d.final_revenue || 0)
          const expenses = Number(d.expenses || 0)
          const profit = revenue - expenses
          const dateLabel = new Date(d.date + 'T00:00:00').getUTCDate().toString()

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
      <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-white/[0.07]">
        <p className="text-sm text-gray-500">
          No daily data yet for {selectedMonth}
        </p>
      </div>
    )
  }

  return (
    <div className="w-full h-64">
      <h2 className="panel-title mb-3">
        Profit/Loss Trend (Daily)
      </h2>

      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={data}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="rgba(255,255,255,0.06)"
            tick={{ fill: '#7C817A', fontSize: 11 }}
            tickLine={false}
            label={{
              value: 'Day of Month',
              position: 'insideBottom',
              offset: -5,
              fill: '#7C817A',
              fontSize: 11,
            }}
          />
          <YAxis stroke="rgba(255,255,255,0.06)" tick={{ fill: '#7C817A', fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1D201E',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8,
              color: '#ECEDEA',
              fontSize: 12,
            }}
            itemStyle={{ color: '#ECEDEA' }}
            labelStyle={{ color: '#9EA39C', fontWeight: 600 }}
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

          <Legend iconType="square" wrapperStyle={{ color: '#9EA39C', fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#8FB57A"
            strokeWidth={2}
            name="Revenue"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="expenses"
            stroke="#D99A8B"
            strokeWidth={2}
            name="Expenses"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="profit"
            stroke="#A9C0D2"
            strokeWidth={2}
            name="Profit"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
