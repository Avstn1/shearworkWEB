'use client'

import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend
} from 'recharts'
import { Loader2 } from 'lucide-react'

interface HourRow {
  hour: number
  log: number
  success: number
  failed: number
  total?: number
}

interface DayRow {
  day: string
  log: number
  success: number
  failed: number
  total?: number
}

interface Props {
  startDate?: string
  endDate?: string
  targetDate?: string
  viewMode: 'hourly' | 'weekly'
  displayMode: 'separate' | 'aggregate'
}

export default function LoginChart({ startDate, endDate, targetDate, viewMode, displayMode }: Props) {
  const [data, setData] = useState<HourRow[] | DayRow[]>([])
  const [loading, setLoading] = useState(true)
  const [weeks, setWeeks] = useState<string[]>([])

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
    return `${target.getFullYear()}-W${weekNo}`
  }

  // Calculate the actual date range (monday of first week to sunday of last week)
  const getActualWeekRange = () => {
    if (!startDate || !endDate) return { monday: '', sunday: '' }
    
    const start = new Date(startDate + 'T00:00:00')
    const end = new Date(endDate + 'T00:00:00')
    
    // Get Monday of the week containing startDate
    const startDay = start.getDay()
    const monday = new Date(start)
    monday.setDate(start.getDate() - ((startDay + 6) % 7))
    
    // Get Sunday of the week containing endDate
    const endDay = end.getDay()
    const sunday = new Date(end)
    sunday.setDate(end.getDate() + (7 - ((endDay + 6) % 7) - 1))
    
    const format = (d: Date) => d.toISOString().split('T')[0]
    return { monday: format(monday), sunday: format(sunday) }
  }

  const { monday, sunday } = getActualWeekRange()

  // -------------------- Fetch --------------------
  useEffect(() => {
    const fetchData = async () => {
      if (!startDate || !endDate) return
      setLoading(true)

      try {
        if (viewMode === 'hourly') {
          const res = await fetch('/api/analytics/login_summary', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ summaryType: 'hourly', startDate, endDate, targetDate }),
          })
          const result = await res.json()
          const summary = result.data?.summary || []
          
          // Add total field for aggregate mode
          const dataWithTotal = summary.map((row: HourRow) => ({
            ...row,
            total: row.success + row.failed
          }))
          
          setData(dataWithTotal)
        } else {
          // Weekly
          const weekList: string[] = []
          let curr = new Date(startDate + 'T00:00:00')
          const end = new Date(endDate + 'T00:00:00')
          while (curr <= end) {
            weekList.push(getISOWeek(curr.toISOString().split('T')[0]))
            curr.setDate(curr.getDate() + 7)
          }
          setWeeks(weekList)

          const merged: DayRow[] = Array.from({ length: 7 }, (_, i) => ({
            day: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i],
            log: 0,
            success: 0,
            failed: 0,
            total: 0
          }))

          for (const isoWeek of weekList) {
            const res = await fetch('/api/analytics/login_summary', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify({ summaryType: 'weekly', isoWeek }),
            })
            const result = await res.json()
            const weekData: DayRow[] = Array.isArray(result.data?.summary) ? result.data.summary : []
            weekData.forEach((d, i) => {
              merged[i].log += d?.log ?? 0
              merged[i].success += d?.success ?? 0
              merged[i].failed += d?.failed ?? 0
            })
          }

          // Calculate totals
          merged.forEach(day => {
            day.total = day.success + day.failed
          })

          setData(merged)
        }
      } catch (err) {
        console.error('❌ Login fetch error:', err)
        if (viewMode === 'hourly') {
          setData([])
        } else {
          setData(Array.from({ length: 7 }, (_, i) => ({ 
            day: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i], 
            log: 0, 
            success: 0, 
            failed: 0,
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
  const totalLogs = data.reduce((sum, row) => sum + row.log, 0)
  const isoWeekDisplay = weeks.length === 1 ? weeks[0] : `${weeks[0]} - ${weeks[weeks.length-1]}`
  const titleText = viewMode === 'hourly'
    ? targetDate
      ? `User Login Activity for ${targetDate}`
      : startDate && endDate
      ? `User Login Activity from ${startDate} to ${endDate}`
      : 'User Login Activity'
    : `Weekly User Login Activity from ${monday} to ${sunday}`


  // -------------------- Tooltip --------------------
  const tooltipContent = ({ payload, label }: any) => {
    if (!payload || payload.length === 0) return null
    const formattedLabel = viewMode === 'hourly'
      ? `${Number(label) % 12 === 0 ? 12 : Number(label) % 12}${Number(label) < 12 ? 'am' : 'pm'}`
      : label

    return (
      <div
        style={{
          backgroundColor: '#1C212A',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 8,
          padding: '8px 10px',
          color: '#EEF1F5',
          fontSize: 12,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4, color: '#9AA3B2' }}>{formattedLabel}</div>
        {payload.map((p: any) => (
          <div key={p.dataKey} style={{ color: p.color }}>
            {`${p.name}: ${p.value}`}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="mb-3">
        <h2 className="panel-title">{titleText}</h2>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <span className="badge tabular-nums">Logs: {totalLogs}</span>
          <span className="badge capitalize">Mode: {displayMode}</span>
        </p>
      </div>

      <div className="w-full h-64 relative">
        {loading ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted">
            <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
            Loading {viewMode} login data...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey={viewMode === 'hourly' ? 'hour' : 'day'}
                stroke="rgba(255,255,255,0.06)"
                tick={{ fill: '#7B8596', fontSize: 11 }}
                tickLine={false}
                tickFormatter={viewMode === 'hourly' ? (h) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}` : undefined}
              />
              <YAxis stroke="rgba(255,255,255,0.06)" tick={{ fill: '#7B8596', fontSize: 11 }} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
              <Tooltip content={tooltipContent} cursor={{ stroke: 'rgba(255,255,255,0.12)' }} />
              <Legend iconType="plainline" iconSize={12} wrapperStyle={{ fontSize: 12, color: '#9AA3B2' }} />
              
              {displayMode === 'separate' ? (
                <>
                  <Line 
                    type="monotone" 
                    dataKey="success" 
                    name="Success"
                    stroke="#3DD27A" 
                    strokeWidth={2} 
                    dot={false} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="failed" 
                    name="Failed"
                    stroke="#5AA9FF" 
                    strokeWidth={2} 
                    dot={false} 
                  />
                </>
              ) : (
                <Line 
                  type="monotone" 
                  dataKey="total" 
                  name="Total Logins"
                  stroke="#3DD27A"                   
                  strokeWidth={2} 
                  dot={false} 
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}