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

interface HourRow {
  hour: number
  log: number
  success: number
  failed: number
}

interface HourlyLoginChartProps {
  targetDate?: string
  startDate?: string
  endDate?: string
}

export default function HourlyLoginChart({
  targetDate,
  startDate,
  endDate,
}: HourlyLoginChartProps) {
  const [data, setData] = useState<HourRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSummary = async () => {
      if (!targetDate && (!startDate || !endDate)) return
      setLoading(true)

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}functions/v1/hourly_login`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              summaryType: 'hourly',
              targetDate: targetDate ?? '2025-11-14'
            }),
          }
        )

        if (!response.ok) {
          throw new Error('Failed to fetch')
        }

        const result = await response.json()
        setData(result?.summary || [])
      } catch (error) {
        console.error('❌ Error:', error)
        setData([])
      } finally {
        setLoading(false)
      }
    }

    fetchSummary()
  }, [targetDate, startDate, endDate])

  const totalLogs = data.reduce((sum, row) => sum + row.log, 0)

  const title =
    targetDate
      ? `Hourly User Login Activity for ${targetDate}`
      : startDate && endDate
      ? `Hourly User Login Activity from ${startDate} to ${endDate}`
      : ''

  if (loading) {
    return (
      <div className="p-4 text-center text-[#E8EDC7] opacity-70 text-sm">
        Loading hourly login data...
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div
        className="p-4 rounded-lg shadow-md border flex items-center justify-center min-h-[200px]"
        style={{
          borderColor: 'var(--card-revenue-border)',
          background: 'var(--card-revenue-bg)',
        }}
      >
        <p className="text-[#E8EDC7] opacity-70 text-sm">No login data</p>
      </div>
    )
  }

  return (
    <div className="w-full h-64 relative">
      <h2 className="text-[#c4d2b8] font-semibold mb-2 text-sm sm:text-base">{title} | Logs fetched: {totalLogs}</h2>

      <ResponsiveContainer width="100%" height="100%">
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
            labelFormatter={(hour) => {
              // Example: convert 0-23 hour to 12-hour format with AM/PM
              const h = Number(hour)
              const ampm = h >= 12 ? 'PM' : 'AM'
              const hour12 = h % 12 === 0 ? 12 : h % 12
              return `${hour12} ${ampm}`
            }}
          />
          <Legend />
          <Line type="monotone" dataKey="success" stroke="#00e676" strokeWidth={2} name="Success" dot={false} />
          <Line type="monotone" dataKey="failed" stroke="#ff6d00" strokeWidth={2} name="Failed" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}