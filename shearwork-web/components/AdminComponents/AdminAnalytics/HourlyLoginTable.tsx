'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
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

interface HourRow {
  hour: number
  log: number
  success: number
  pending: number
  failed: number
}

interface HourlyLoginChartProps {
  targetDate: string // 'YYYY-MM-DD'
}

export default function HourlyLoginChart({ targetDate }: HourlyLoginChartProps) {
  const [data, setData] = useState<HourRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      if (!targetDate) return

      setLoading(true)
      const dimension = `hourly|${targetDate}`

      const { data: summary, error } = await supabase
        .from('system_logs_summary')
        .select('*')
        .eq('dimension', dimension)
        .eq('action', 'user_login')
        .maybeSingle()

      console.log('Fetched hourly summary data:', summary)

      if (error) {
        console.error('❌ Error fetching hourly summary:', error)
        setData([])
        setLoading(false)
        return
      }

      if (!summary) {
        setData([])
        setLoading(false)
        return
      }

      // Always show 24 hours, fill missing hours with 0
      const hours = 24
      const formatted: HourRow[] = Array.from({ length: hours }, (_, i) => ({
        hour: i,
        log: summary.log_count[i] || 0,
        success: summary.success_count[i] || 0,
        pending: summary.pending_count[i] || 0,
        failed: summary.failed_count[i] || 0,
      }))

      setData(formatted)
      setLoading(false)
    }

    fetchData()
  }, [targetDate])

  if (loading) {
    return (
      <div className="p-4 text-center text-[#E8EDC7] opacity-70 text-sm">
        Loading hourly login data...
      </div>
    )
  }

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
          No login data for {targetDate}
        </p>
      </div>
    )
  }

  return (
    <div className="w-full h-64">
      <h2 className="text-[#c4d2b8] font-semibold mb-2 text-sm sm:text-lg">
        Hourly User Login Activity
      </h2>

      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            dataKey="hour"
            stroke="#ccc"
            label={{
              value: 'Hour of Day',
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
                case 'log':
                  label = 'Total Logs'
                  break
                case 'success':
                  label = 'Success'
                  break
                case 'pending':
                  label = 'Pending'
                  break
                case 'failed':
                  label = 'Failed'
                  break
                default:
                  label = name
              }
              return [value, label]
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="log"
            stroke="#aeea00"
            strokeWidth={2}
            name="Total Logs"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="success"
            stroke="#00e676"
            strokeWidth={2}
            name="Success"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="pending"
            stroke="#ffeb3b"
            strokeWidth={2}
            name="Pending"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="failed"
            stroke="#ff6d00"
            strokeWidth={2}
            name="Failed"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
