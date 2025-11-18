'use client'

import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend
} from 'recharts'

interface HourRow {
  hour: number
  log: number
  success: number
  failed: number
}

interface DayRow {
  day: string
  log: number
  success: number
  failed: number
}

interface Props {
  startDate?: string
  endDate?: string
  targetDate?: string
}

export default function LoginChartToggle({ startDate, endDate, targetDate }: Props) {
  const [mode, setMode] = useState<'hourly' | 'weekly'>('hourly')
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
          const res = await fetch('/api/analytics/login_summary', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ summaryType: 'hourly', startDate, endDate, targetDate }),
          })
          const result = await res.json()
          setData(result.data?.summary || [])
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
            failed: 0
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
          setData(merged)
        }
      } catch (err) {
        console.error('❌ Fetch error:', err)
        if (mode === 'hourly') setData([])
        else setData(Array.from({ length: 7 }, (_, i) => ({ day: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i], log: 0, success: 0, failed: 0 })))
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [startDate, endDate, targetDate, mode])

  // -------------------- Title --------------------
  const totalLogs = data.reduce((sum, row) => sum + row.log, 0)
  const isoWeekDisplay = weeks.length === 1 ? weeks[0] : `${weeks[0]} - ${weeks[weeks.length-1]}`
  const titleText = mode === 'hourly'
    ? targetDate
      ? `Hourly User Login Activity for ${targetDate}`
      : startDate && endDate
      ? `Hourly User Login Activity from ${startDate} to ${endDate}`
      : 'Hourly User Login Activity'
    : `Weekly User Login Activity from ${monday} to ${sunday}`

  const title = `${titleText} | Logs fetched: ${totalLogs}`

  // -------------------- Tooltip --------------------
  const tooltipContent = ({ payload, label }: any) => {
    if (!payload || payload.length === 0) return null
    const success = payload.find((p: any) => p.dataKey === 'success')?.value ?? 0
    const failed = payload.find((p: any) => p.dataKey === 'failed')?.value ?? 0
    const formattedLabel = mode === 'hourly'
      ? `${Number(label) % 12 === 0 ? 12 : Number(label) % 12}${Number(label) < 12 ? 'am' : 'pm'}`
      : label

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
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{formattedLabel}</div>
        <div>{`Success: ${success}`}</div>
        <div>{`Failed: ${failed}`}</div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[#c4d2b8] font-semibold text-sm sm:text-base">{title}</h2>
        <button
          onClick={() => !loading && setMode(mode === 'hourly' ? 'weekly' : 'hourly')}
          disabled={loading}
          className={`
            px-3 py-1 rounded-md border text-sm font-medium
            transition-colors duration-1500 ease-in-out
            ${loading
              ? 'bg-gray-600 border-gray-600 text-gray-300 cursor-not-allowed'
              : mode === 'hourly'
              ? 'bg-green-900 border-green-400 text-green-100 hover:bg-green-400'
              : 'bg-green-1100 border-green-500 text-green-100 hover:bg-green-500'}
          `}
        >
          {loading ? 'Loading...' : mode === 'hourly' ? 'Switch to Weekly' : 'Switch to Hourly'}
        </button>
      </div>

      <div className="w-full h-64 relative">
        {loading ? (
          <div className="p-4 text-center text-[#E8EDC7] opacity-70 text-sm">
            Loading {mode} login data...
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
              <Line type="monotone" dataKey="success" stroke="#00e676" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="failed" stroke="#ff6d00" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
