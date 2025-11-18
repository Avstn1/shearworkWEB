'use client'

import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend
} from 'recharts'

interface HourRow {
  hour: number
  total: number
}

interface DayRow {
  day: string
  total: number
}

interface Props {
  startDate?: string
  endDate?: string
  targetDate?: string
  viewMode: 'hourly' | 'weekly'
}

export default function AggregateChart({ startDate, endDate, targetDate, viewMode }: Props) {
  const [data, setData] = useState<HourRow[] | DayRow[]>([])
  const [loading, setLoading] = useState(true)

  // -------------------- Helpers --------------------
  function getISOWeek(dateStr: string) {
    const date = new Date(dateStr + 'T00:00:00')
    if (isNaN(date.getTime())) return 'Invalid-W00'
    const target = new Date(date)
    const day = target.getDay()
    const diff = (day === 0 ? 6 : day - 1)
    target.setDate(target.getDate() - diff + 3)
    const yearStart = new Date(target.getFullYear(), 0, 4)
    const weekNo = Math.floor(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7) + 1
    return `${target.getFullYear()}-W${String(weekNo).padStart(2, '0')}`
  }

  function getWeekRange(dateStr: string) {
    const date = new Date(dateStr + 'T00:00:00')
    const day = date.getDay()
    const monday = new Date(date)
    monday.setDate(date.getDate() - ((day + 6) % 7))
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const format = (d: Date) => d.toISOString().split('T')[0]
    return { monday: format(monday), sunday: format(sunday) }
  }

  const { monday, sunday } = startDate ? getWeekRange(startDate) : { monday: '', sunday: '' }

  // -------------------- Fetch --------------------
  useEffect(() => {
    const fetchData = async () => {
      if (!startDate || !endDate) return
      setLoading(true)

      try {
        if (viewMode === 'hourly') {
          const res = await fetch('/api/analytics/aggregate_summary', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ summaryType: 'hourly', startDate, endDate, targetDate }),
          })
          const result = await res.json()
          
          console.log('📊 Hourly Aggregate Response:', result)
          
          const summary = result.data?.summary || []
          
          if (Array.isArray(summary) && summary.length > 0) {
            setData(summary as HourRow[])
            console.log('✅ Set hourly aggregate data:', summary.length, 'hours')
          } else {
            console.warn('⚠️ No hourly aggregate data received')
            setData(Array.from({ length: 24 }, (_, h) => ({
              hour: h,
              total: 0
            })))
          }
        } else {
          // Weekly mode - need to aggregate across multiple weeks
          const weekList: string[] = []
          let curr = new Date(startDate + 'T00:00:00')
          const end = new Date(endDate + 'T00:00:00')
          
          while (curr <= end) {
            weekList.push(getISOWeek(curr.toISOString().split('T')[0]))
            curr.setDate(curr.getDate() + 7)
          }

          console.log('📅 Fetching aggregate weeks:', weekList)

          // Initialize merged data
          const merged: DayRow[] = Array.from({ length: 7 }, (_, i) => ({
            day: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i],
            total: 0
          }))

          // Fetch and merge each week
          for (const isoWeek of weekList) {
            const res = await fetch('/api/analytics/aggregate_summary', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify({ summaryType: 'weekly', isoWeek }),
            })
            const result = await res.json()
            const weekData: DayRow[] = result.data?.summary || []

            console.log(`📊 Aggregate Week ${isoWeek} data:`, weekData)

            // Merge this week's data into the accumulated totals
            weekData.forEach((dayData, dayIndex) => {
              if (dayIndex >= 0 && dayIndex < 7) {
                merged[dayIndex].total += dayData.total || 0
              }
            })
          }

          console.log('✅ Set weekly aggregate merged data:', merged)
          setData(merged)
        }
      } catch (err) {
        console.error('❌ Aggregate fetch error:', err)
        if (viewMode === 'hourly') {
          setData(Array.from({ length: 24 }, (_, h) => ({
            hour: h,
            total: 0
          })))
        } else {
          setData(Array.from({ length: 7 }, (_, i) => ({
            day: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i],
            total: 0
          })))
        }
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [startDate, endDate, targetDate, viewMode])

  // -------------------- Title --------------------
  const totalLogs = data.reduce((sum, row) => sum + (row as any).total, 0)

  const titleText = viewMode === 'hourly'
    ? targetDate
      ? `Hourly Total System Activity for ${targetDate}`
      : startDate && endDate
      ? `Hourly Total System Activity from ${startDate} to ${endDate}`
      : 'Hourly Total System Activity'
    : `Weekly Total System Activity from ${monday} to ${sunday}`

  const title = `${titleText} | Total Logs: ${totalLogs}`

  // -------------------- Tooltip --------------------
  const tooltipContent = ({ payload, label }: any) => {
    if (!payload || payload.length === 0) return null
    return (
      <div
        style={{
          backgroundColor: '#1f2420',
          border: '1px solid #55694b',
          borderRadius: '0.5rem',
          padding: '8px',
          color: '#c4d2b8',
          fontSize: '0.875rem',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          {viewMode === 'hourly' ? `${Number(label)%12||12}${Number(label)<12?'am':'pm'}` : label}
        </div>
        {payload.map((p: any) => (
          <div key={p.dataKey} style={{ color: p.color }}>
            {`${p.name}: ${p.value}`}
          </div>
        ))}
      </div>
    )
  }

  // -------------------- Render --------------------
  return (
    <div className="w-full">
      <div className="mb-2">
        <h2 className="text-[#c4d2b8] font-semibold text-sm sm:text-base">{title}</h2>
        <p className="text-xs text-[#bdbdbd] mt-0.5">All system actions combined</p>
      </div>

      <div className="w-full h-64 relative">
        {loading ? (
          <div className="p-4 text-center text-[#E8EDC7] opacity-70 text-sm">
            Loading {viewMode} aggregate data...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                dataKey={viewMode === 'hourly' ? 'hour' : 'day'}
                stroke="#ccc"
                tickFormatter={viewMode === 'hourly' ? (h) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}` : undefined}
              />
              <YAxis stroke="#ccc" />
              <Tooltip content={tooltipContent} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="total" 
                name="Total Activity"
                stroke="#9c27b0" 
                strokeWidth={3} 
                dot={false}
                strokeLinecap="round"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}