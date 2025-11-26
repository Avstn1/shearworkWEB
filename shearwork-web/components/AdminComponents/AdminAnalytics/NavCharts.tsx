'use client'

import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend
} from 'recharts'

interface HourRow {
  hour: number
  clicked_expenses: number
  clicked_dashboard: number
  clicked_barberEditor: number
  total?: number
}

interface DayRow {
  day: string
  clicked_expenses: number
  clicked_dashboard: number
  clicked_barberEditor: number
  total?: number
}

interface Props {
  startDate?: string
  endDate?: string
  targetDate?: string
  viewMode: 'hourly' | 'weekly'
  displayMode: 'separate' | 'aggregate'
}

export default function NavChart({ startDate, endDate, targetDate, viewMode, displayMode }: Props) {
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

  const getActualWeekRange = () => {
    if (!startDate || !endDate) return { monday: '', sunday: '' }
    
    const start = new Date(startDate + 'T00:00:00')
    const end = new Date(endDate + 'T00:00:00')
    
    const startDay = start.getDay()
    const monday = new Date(start)
    monday.setDate(start.getDate() - ((startDay + 6) % 7))
    
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
          const res = await fetch('/api/analytics/nav_summary', {
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
            total: row.clicked_expenses + row.clicked_dashboard + row.clicked_barberEditor
          }))
          
          if (Array.isArray(dataWithTotal) && dataWithTotal.length > 0) {
            setData(dataWithTotal as HourRow[])
          } else {
            setData(Array.from({ length: 24 }, (_, h) => ({
              hour: h,
              clicked_expenses: 0,
              clicked_dashboard: 0,
              clicked_barberEditor: 0,
              total: 0
            })))
          }
        } else {
          // Weekly mode
          const weekList: string[] = []
          let curr = new Date(startDate + 'T00:00:00')
          const end = new Date(endDate + 'T00:00:00')
          
          while (curr <= end) {
            weekList.push(getISOWeek(curr.toISOString().split('T')[0]))
            curr.setDate(curr.getDate() + 7)
          }

          const merged: DayRow[] = Array.from({ length: 7 }, (_, i) => ({
            day: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i],
            clicked_expenses: 0,
            clicked_dashboard: 0,
            clicked_barberEditor: 0,
            total: 0
          }))

          for (const isoWeek of weekList) {
            const res = await fetch('/api/analytics/nav_summary', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify({ summaryType: 'weekly', isoWeek }),
            })
            const result = await res.json()
            const weekData: DayRow[] = result.data?.summary || []

            weekData.forEach((dayData, dayIndex) => {
              if (dayIndex >= 0 && dayIndex < 7) {
                merged[dayIndex].clicked_expenses += dayData.clicked_expenses || 0
                merged[dayIndex].clicked_dashboard += dayData.clicked_dashboard || 0
                merged[dayIndex].clicked_barberEditor += dayData.clicked_barberEditor || 0
              }
            })
          }

          // Calculate totals
          merged.forEach(day => {
            day.total = day.clicked_expenses + day.clicked_dashboard + day.clicked_barberEditor
          })

          setData(merged)
        }
      } catch (err) {
        console.error('❌ Nav fetch error:', err)
        if (viewMode === 'hourly') {
          setData(Array.from({ length: 24 }, (_, h) => ({
            hour: h,
            clicked_expenses: 0,
            clicked_dashboard: 0,
            clicked_barberEditor: 0,
            total: 0
          })))
        } else {
          setData(Array.from({ length: 7 }, (_, i) => ({
            day: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i],
            clicked_expenses: 0,
            clicked_dashboard: 0,
            clicked_barberEditor: 0,
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
  const totalLogs = data.reduce((sum, row) =>
    sum + (row as any).clicked_expenses + (row as any).clicked_dashboard + (row as any).clicked_barberEditor
  , 0)

  const titleText = viewMode === 'hourly'
    ? targetDate
      ? `Action Logs for ${targetDate}`
      : startDate && endDate
      ? `Action Logs from ${startDate} to ${endDate}`
      : 'Action Logs'
    : `Weekly Action Logs from ${monday} to ${sunday}`

  const title = `${titleText} | Logs: ${totalLogs} | Mode: ${displayMode}`

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
      </div>

      <div className="w-full h-64 relative">
        {loading ? (
          <div className="p-4 text-center text-[#E8EDC7] opacity-70 text-sm">
            Loading {viewMode} data...
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
              
              {displayMode === 'separate' ? (
                <>
                  <Line 
                    type="monotone" 
                    dataKey="clicked_expenses" 
                    name="Expenses"
                    stroke="#00e676" 
                    strokeWidth={2} 
                    dot={false} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="clicked_dashboard" 
                    name="Dashboard"
                    stroke="#ff6d00" 
                    strokeWidth={2} 
                    dot={false} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="clicked_barberEditor" 
                    name="Barber Editor"
                    stroke="#1e88e5" 
                    strokeWidth={2} 
                    dot={false} 
                  />
                </>
              ) : (
                <Line 
                  type="monotone" 
                  dataKey="total" 
                  name="Total Actions"
                  stroke="#abf19aff"                   
                  strokeWidth={3} 
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