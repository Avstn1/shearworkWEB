'use client'

import { useEffect, useState } from 'react'
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

interface WeeklyLoginChartProps {
  weekStart?: string    
  weekEnd?: string      
}

export default function WeeklyLoginChart({ weekStart, weekEnd }: WeeklyLoginChartProps) {
  const [data, setData] = useState<{ day: string; log: number; success: number; failed: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchWeeklySummary = async () => {
      if (!weekStart || !weekEnd) return
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
              summaryType: 'weekly',
              startDate: weekStart,
              endDate: weekEnd
            }),
          }
        )

        if (!response.ok) {
          throw new Error('Failed to fetch')
        }

        const result = await response.json()

        if (result?.summary && result.summary.length > 0) {
          const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

          const chartData = result.summary.map((row: any, idx: number) => ({
            day: days[row.day] || days[idx],
            log: row.log,
            success: row.success,
            failed: row.failed,
          }))

          setData(chartData)
        } else {
          setData([])
        }
      } catch (error) {
        console.error('❌ Error:', error)
        setData([])
      } finally {
        setLoading(false)
      }
    }

    fetchWeeklySummary()
  }, [weekStart, weekEnd])

  const totalLogs = data.reduce((sum, row) => sum + row.log, 0)
  const title = weekStart && weekEnd ? `Weekly User Login Activity` : ''

  if (loading) {
    return (
      <div className="p-4 text-center text-[#E8EDC7] opacity-70 text-sm">
        Loading weekly login data...
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="p-4 rounded-lg shadow-md border flex items-center justify-center min-h-[200px]"
           style={{ borderColor: 'var(--card-revenue-border)', background: 'var(--card-revenue-bg)' }}>
        <p className="text-[#E8EDC7] opacity-70 text-sm">No login data</p>
      </div>
    )
  }

  return (
    <div className="w-full h-64 relative">
      <h2 className="text-[#c4d2b8] font-semibold mb-2 text-sm sm:text-base">
        {title} | Logs fetched: {totalLogs}
      </h2>

      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="day" stroke="#ccc" />
          <YAxis stroke="#ccc" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#2b2b2b',
              border: '1px solid #C8B653',
              borderRadius: '8px',
              color: '#F5F5DC',
            }}
            itemStyle={{ color: '#E8EDC7' }}
          />
          <Legend />
          <Line type="monotone" dataKey="success" stroke="#00e676" strokeWidth={2} name="Success" dot={false} />
          <Line type="monotone" dataKey="failed" stroke="#ff6d00" strokeWidth={2} name="Failed" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}