'use client'

import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend
} from 'recharts'
import { Loader2 } from 'lucide-react'

interface HourRow {
  hour: number
  clicked_expenses: number
  clicked_dashboard: number
  clickedSMSAutoNudge: number
  clickedSMSCampaigns: number
  clicked_clientSheets: number
  clicked_appointmentSheets: number
  total?: number
}

interface DayRow {
  day: string
  clicked_expenses: number
  clicked_dashboard: number
  clickedSMSAutoNudge: number
  clickedSMSCampaigns: number
  clicked_clientSheets: number
  clicked_appointmentSheets: number
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
    return `${target.getFullYear()}-W${weekNo}`
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
            total: row.clicked_expenses + row.clicked_dashboard + row.clickedSMSAutoNudge + 
                   row.clickedSMSCampaigns + row.clicked_clientSheets + row.clicked_appointmentSheets
          }))
          
          if (Array.isArray(dataWithTotal) && dataWithTotal.length > 0) {
            setData(dataWithTotal as HourRow[])
          } else {
            setData(Array.from({ length: 24 }, (_, h) => ({
              hour: h,
              clicked_expenses: 0,
              clicked_dashboard: 0,
              clickedSMSAutoNudge: 0,
              clickedSMSCampaigns: 0,
              clicked_clientSheets: 0,
              clicked_appointmentSheets: 0,
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
            clickedSMSAutoNudge: 0,
            clickedSMSCampaigns: 0,
            clicked_clientSheets: 0,
            clicked_appointmentSheets: 0,
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
            console.log('Weekly fetch result:', JSON.stringify(result))
            const weekData: DayRow[] = result.data?.summary || []

            // The edge function already returns aggregated numbers per day
            // Just sum them across weeks
            weekData.forEach((dayData, dayIndex) => {
              if (dayIndex >= 0 && dayIndex < 7) {
                merged[dayIndex].clicked_expenses += Number(dayData.clicked_expenses) || 0
                merged[dayIndex].clicked_dashboard += Number(dayData.clicked_dashboard) || 0
                merged[dayIndex].clickedSMSAutoNudge += Number(dayData.clickedSMSAutoNudge) || 0
                merged[dayIndex].clickedSMSCampaigns += Number(dayData.clickedSMSCampaigns) || 0
                merged[dayIndex].clicked_clientSheets += Number(dayData.clicked_clientSheets) || 0
                merged[dayIndex].clicked_appointmentSheets += Number(dayData.clicked_appointmentSheets) || 0
              }
            })
          }

          // Calculate totals
          merged.forEach(day => {
            day.total = day.clicked_expenses + day.clicked_dashboard + day.clickedSMSAutoNudge + 
                        day.clickedSMSCampaigns + day.clicked_clientSheets + day.clicked_appointmentSheets
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
            clickedSMSAutoNudge: 0,
            clickedSMSCampaigns: 0,
            clicked_clientSheets: 0,
            clicked_appointmentSheets: 0,
            total: 0
          })))
        } else {
          setData(Array.from({ length: 7 }, (_, i) => ({
            day: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i],
            clicked_expenses: 0,
            clicked_dashboard: 0,
            clickedSMSAutoNudge: 0,
            clickedSMSCampaigns: 0,
            clicked_clientSheets: 0,
            clicked_appointmentSheets: 0,
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
    sum + (row as any).clicked_expenses + (row as any).clicked_dashboard + (row as any).clickedSMSAutoNudge +
    (row as any).clickedSMSCampaigns + (row as any).clicked_clientSheets + (row as any).clicked_appointmentSheets
  , 0)

  const titleText = viewMode === 'hourly'
    ? targetDate
      ? `Action Logs for ${targetDate}`
      : startDate && endDate
      ? `Action Logs from ${startDate} to ${endDate}`
      : 'Action Logs'
    : `Weekly Action Logs from ${monday} to ${sunday}`


  // -------------------- Tooltip --------------------
  const tooltipContent = ({ payload, label }: any) => {
    if (!payload || payload.length === 0) return null
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
        <div style={{ fontWeight: 600, marginBottom: 4, color: '#9AA3B2' }}>
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
            Loading {viewMode} data...
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
                    dataKey="clicked_expenses" 
                    name="Expenses"
                    stroke="#3DD27A" 
                    strokeWidth={2} 
                    dot={false} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="clicked_dashboard" 
                    name="Dashboard"
                    stroke="#5AA9FF" 
                    strokeWidth={2} 
                    dot={false} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="clickedSMSAutoNudge" 
                    name="SMS Auto Nudge"
                    stroke="#FFB547" 
                    strokeWidth={2} 
                    dot={false} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="clickedSMSCampaigns" 
                    name="SMS Campaigns"
                    stroke="#A78BFA" 
                    strokeWidth={2} 
                    dot={false} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="clicked_clientSheets" 
                    name="Client Sheets"
                    stroke="#FF7A66" 
                    strokeWidth={2} 
                    dot={false} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="clicked_appointmentSheets" 
                    name="Appointment Sheets"
                    stroke="#2DD4BF" 
                    strokeWidth={2} 
                    dot={false} 
                  />
                </>
              ) : (
                <Line 
                  type="monotone" 
                  dataKey="total" 
                  name="Total Actions"
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