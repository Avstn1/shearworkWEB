'use client'

import React, { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '@/utils/supabaseClient'

interface Props {
  userId: string
  year: number
}

interface DayData {
  weekday: string
  total_appointments: number
}

export default function AppointmentsByWeekdayChart({ userId, year }: Props) {
  const [data, setData] = useState<DayData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    const fetchData = async () => {
      setLoading(true)
      try {
        const { data: rows, error } = await supabase
          .from('yearly_appointments_summary')
          .select('weekday, total_appointments')
          .eq('user_id', userId)
          .eq('year', year)
        if (error) throw error

        const orderedDays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
        const mapped: DayData[] = orderedDays.map(day => {
          const row = rows.find(r => r.weekday === day)
          return {
            weekday: day,
            total_appointments: row ? row.total_appointments : 0
          }
        })

        setData(mapped)
      } catch (err) {
        console.error('Error fetching weekday appointments:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [userId, year])

  return (
    <div className="h-[300px] flex flex-col">
      <h2 className="text-[#E8EDC7] text-base font-semibold mb-3">📅 Appointments by Weekday</h2>
      {loading ? (
        <div className="text-[#F5E6C5] text-sm">Loading chart...</div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="weekday" tick={{ fill: '#d1e2c5', fontSize: 12 }} />
            <YAxis tick={{ fill: '#d1e2c5', fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1a1f1b',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#F5E6C5',
              }}
            />
            <Bar dataKey="total_appointments" fill="#c4ff85" radius={[6,6,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
