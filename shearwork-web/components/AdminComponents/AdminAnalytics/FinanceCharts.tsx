'use client'

import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend
} from 'recharts'

interface HourRow {
  hour: number
  add_tips: number
  expense_edited: number
  expense_added: number
}

interface DayRow {
  day: string
  add_tips: number
  expense_edited: number
  expense_added: number
}

interface Props {
  startDate?: string
  endDate?: string
  targetDate?: string
}

export default function NavChart({ startDate, endDate, targetDate }: Props) {
  const [mode, setMode] = useState<'hourly' | 'weekly'>('hourly')
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
        if (mode === 'hourly') {
          const res = await fetch('/api/analytics/finance_summary', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ summaryType: 'hourly', startDate, endDate, targetDate }),
          })
          const result = await res.json()
          
          // The edge function returns data already in the correct format!
          const summary = result.data?.summary || []
          
          if (Array.isArray(summary) && summary.length > 0) {
            setData(summary as HourRow[])
          } else {
            console.warn('⚠️ No hourly data received')
            setData(Array.from({ length: 24 }, (_, h) => ({
              hour: h,
              add_tips: 0,
              expense_edited: 0,
              expense_added: 0
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

          // Initialize merged data
          const merged: DayRow[] = Array.from({ length: 7 }, (_, i) => ({
            day: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i],
            add_tips: 0,
            expense_edited: 0,
            expense_added: 0
          }))

          // Fetch and merge each week
          for (const isoWeek of weekList) {
            const res = await fetch('/api/analytics/finance_summary', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify({ summaryType: 'weekly', isoWeek }),
            })
            const result = await res.json()
            const weekData: DayRow[] = result.data?.summary || []

            // Merge this week's data into the accumulated totals
            weekData.forEach((dayData, dayIndex) => {
              if (dayIndex >= 0 && dayIndex < 7) {
                merged[dayIndex].add_tips += dayData.add_tips || 0
                merged[dayIndex].expense_edited += dayData.expense_edited || 0
                merged[dayIndex].expense_added += dayData.expense_added || 0
              }
            })
          }

          setData(merged)
        }
      } catch (err) {
        console.error('❌ Fetch error:', err)
        // Set empty data on error
        if (mode === 'hourly') {
          setData(Array.from({ length: 24 }, (_, h) => ({
            hour: h,
            add_tips: 0,
            expense_edited: 0,
            expense_added: 0
          })))
        } else {
          setData(Array.from({ length: 7 }, (_, i) => ({
            day: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i],
            add_tips: 0,
            expense_edited: 0,
            expense_added: 0
          })))
        }
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [startDate, endDate, targetDate, mode])

  // -------------------- Title --------------------
  const totalLogs = data.reduce((sum, row) =>
    sum + (row as any).add_tips + (row as any).expense_edited + (row as any).expense_added
  , 0)

  const titleText = mode === 'hourly'
    ? targetDate
      ? `Hourly Finance Logs for ${targetDate}`
      : startDate && endDate
      ? `Hourly Finance Logs from ${startDate} to ${endDate}`
      : 'Hourly Finance Logs'
    : `Weekly Finance Logs from ${monday} to ${sunday}`

  const title = `${titleText} | Logs fetched: ${totalLogs}`

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
          {mode === 'hourly' ? `${Number(label)%12||12}${Number(label)<12?'am':'pm'}` : label}
        </div>
        {payload.map((p: any) => (
          <div key={p.dataKey} style={{ color: p.color }}>
            {`${p.name.replace('clicked_', '').replace('_', ' ')}: ${p.value}`}
          </div>
        ))}
      </div>
    )
  }

  // -------------------- Render --------------------
  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[#c4d2b8] font-semibold text-sm sm:text-base">{title}</h2>
        <button
          onClick={() => !loading && setMode(mode === 'hourly' ? 'weekly' : 'hourly')}
          disabled={loading}
          className={`
            px-3 py-1 rounded-md border text-sm font-medium
            transition-colors duration-500 ease-in-out
            ${loading
              ? 'bg-gray-600 border-gray-600 text-gray-300 cursor-not-allowed'
              : mode === 'hourly'
              ? 'bg-green-400 border-green-500 text-green-900 hover:bg-green-500'
              : 'bg-green-500 border-green-600 text-green-50 hover:bg-green-600'}
          `}
        >
          {loading ? 'Loading...' : mode === 'hourly' ? 'Switch to Weekly' : 'Switch to Hourly'}
        </button>
      </div>

      <div className="w-full h-64 relative">
        {loading ? (
          <div className="p-4 text-center text-[#E8EDC7] opacity-70 text-sm">
            Loading {mode} data...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                dataKey={mode === 'hourly' ? 'hour' : 'day'}
                stroke="#ccc"
                tickFormatter={mode === 'hourly' ? (h) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}` : undefined}
              />
              <YAxis stroke="#ccc" />
              <Tooltip content={tooltipContent} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="add_tips" 
                name="Add Tips"
                stroke="#00e676" 
                strokeWidth={2} 
                dot={false} 
              />
              <Line 
                type="monotone" 
                dataKey="expense_edited" 
                name="Edit Expense"
                stroke="#ff6d00" 
                strokeWidth={2} 
                dot={false} 
              />
              <Line 
                type="monotone" 
                dataKey="expense_added" 
                name="Add Expense"
                stroke="#1e88e5" 
                strokeWidth={2} 
                dot={false} 
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}