'use client'

import React, { useEffect, useState } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { supabase } from '@/utils/supabaseClient'

const COLORS = [
  '#C8B653', // gold
  '#A67C52', // bronze
  '#C97A84', // muted rose
  '#7A8E69', // olive
  '#5DAA8A', // teal
  '#6E7DA2', // slate blue
  '#E8EDC7', // cream
]

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

export default function ServiceBreakdownChart({
  barberId,
  month,
  year,
}: ServiceBreakdownChartProps) {
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
      className="p-4 rounded-lg shadow-md border border-[color:var(--card-revenue-border)] flex flex-col"
      style={{
        background: 'var(--card-revenue-bg)',
        height: '360px',
        overflow: 'visible',
      }}
    >
      <h2 className="text-[#E8EDC7] text-base font-semibold mb-4 text-xl">
        💈 Service Breakdown
      </h2>
      <div className="flex-1 flex overflow-visible">
        <ResponsiveContainer width="80%" height="100%">
          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Pie
              data={data}
              dataKey="bookings"
              nameKey="service_name"
              outerRadius="90%"
              isAnimationActive={false}
              labelLine={false}
              label={false}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>

            <Tooltip
              contentStyle={{
                backgroundColor: '#1E1E1C',
                border: '1px solid #C8B653',
                borderRadius: '8px',
                boxShadow: '0 0 10px rgba(200, 182, 83, 0.3)',
                color: '#F5F5DC',
                padding: '8px 12px',
              }}
              itemStyle={{
                color: '#E8EDC7',
                fontWeight: 500,
              }}
              labelStyle={{
                color: '#C8B653',
                fontWeight: 600,
              }}
              formatter={(value, name) => [`${value} bookings`, name]}
            />

            <Legend
              layout="vertical"
              verticalAlign="middle"
              align="right"
              iconType="circle"
              wrapperStyle={{
                color: '#E8EDC7',
                fontSize: '0.85rem',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
