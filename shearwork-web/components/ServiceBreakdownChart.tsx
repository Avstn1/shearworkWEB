'use client'

import React, { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { supabase } from '@/utils/supabaseClient'

const COLORS = ['#82ca9d', '#8884d8', '#ffc658', '#ff7f7f']

export interface ServiceBooking {
  service_name: string
  bookings: number
  [key: string]: string | number | undefined
}

interface ServiceBreakdownChartProps {
  barberId: string
  month: string
  year: number
}

export default function ServiceBreakdownChart({ barberId, month, year }: ServiceBreakdownChartProps) {
  const [data, setData] = useState<ServiceBooking[]>([])

  useEffect(() => {
    const fetchData = async () => {
      const { data: bookings, error } = await supabase
        .from('service_bookings')
        .select('service_name, bookings')
        .eq('user_id', barberId)
        .eq('report_month', month)
        .eq('report_year', year)

      if (error) {
        console.error('Error fetching service bookings:', error)
        return
      }

      setData(bookings as ServiceBooking[])
    }

    fetchData()
  }, [barberId, month, year])

  if (data.length === 0) return <p>Loading service data...</p>

  return (
    <div
      className="p-4 rounded-lg shadow-md border border-[color:var(--card-revenue-border)] flex flex-col h-[340px]"
      style={{ background: 'var(--card-revenue-bg)' }}
    >
      <h2 className="text-[#E8EDC7] text-base font-semibold mb-4">💈 Service Breakdown</h2>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="bookings"
            nameKey="service_name"
            outerRadius={100}
            label
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
