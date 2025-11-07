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
  '#F6E27F', // soft gold
  '#E7B7A3', // muted rose
  '#A7C7E7', // powder blue
  '#C6D8A8', // sage green
  '#9AD1C9', // teal pastel
  '#B7A0E3', // lavender
  '#F5D6C6', // peach
  '#F7C9D2', // blush pink
  '#C9E5D3', // mint pastel
  '#D6D6D6', // soft gray
  '#E1D5F3', // light violet
  '#FFE3A3', // pale yellow
  '#A3D0FF', // soft sky blue
  '#B0E0E6', // pale cyan
  '#D0C9FF', // lilac
  '#F0E2D6', // cream beige
  '#C5F0C5', // light green
  '#FFB3B3', // pastel coral
  '#D3F4FF', // icy blue
  '#E3C5FF', // pastel purple
  '#FFE0B2', // light apricot
  '#B2FFD9', // minty turquoise
  '#F2B2FF', // soft neon pink
  '#C4C4C4', // steel gray
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

      // Sort data by number of bookings (descending)
      const sortedData = (bookings as ServiceBooking[]).sort(
        (a, b) => (b.bookings || 0) - (a.bookings || 0)
      )

      setData(sortedData)
    }

    fetchData()
  }, [barberId, month, year])

  if (data.length === 0)
    return (
      <div
        className="p-4 rounded-lg shadow-md border flex items-center justify-center min-h-[360px]"
        style={{
          borderColor: 'var(--card-revenue-border)',
          background: 'var(--card-revenue-bg)',
        }}
      >
        <p className="text-[#E8EDC7] opacity-70">No data to see here yet!</p>
      </div>
    )

  return (
    <div
      className="p-4 rounded-lg shadow-md border flex flex-col flex-1"
      style={{
        borderColor: 'var(--card-revenue-border)',
        background: 'var(--card-revenue-bg)',
        minHeight: '360px',
        maxHeight: '420px',
      }}
    >
      <h2 className="text-[#E8EDC7] text-xl font-semibold mb-4">
        💈 Service Breakdown
      </h2>

      <div className="flex-1 flex items-center justify-center overflow-visible">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 0, right: 0, bottom: 40, left: 0 }}>
            <Pie
              data={data}
              dataKey="bookings"
              nameKey="service_name"
              outerRadius="80%"
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
              itemStyle={{ color: '#E8EDC7', fontWeight: 500 }}
              labelStyle={{ color: '#C8B653', fontWeight: 600 }}
              formatter={(value, name) => [`${value} bookings`, name]}
            />

            <Legend
              layout="horizontal"
              verticalAlign="bottom"
              align="center"
              iconType="circle"
              wrapperStyle={{
                color: '#E8EDC7',
                fontSize: '0.85rem',
                flexWrap: 'wrap',
                marginTop: '12px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
