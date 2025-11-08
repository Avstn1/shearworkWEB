'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const COLORS = [
  '#F6E27F', '#E7B7A3', '#A7C7E7', '#C6D8A8', '#9AD1C9',
  '#B7A0E3', '#F5D6C6', '#F7C9D2', '#C9E5D3', '#D6D6D6',
  '#E1D5F3', '#FFE3A3', '#A3D0FF', '#B0E0E6', '#D0C9FF',
  '#F0E2D6', '#C5F0C5', '#FFB3B3', '#D3F4FF', '#E3C5FF',
  '#FFE0B2', '#B2FFD9', '#F2B2FF', '#C4C4C4',
]

export interface ServiceBooking {
  service_name: string
  bookings: number
  [key: string]: string | number
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
        console.error(error)
        return
      }

      setData(
        (bookings as ServiceBooking[]).sort(
          (a, b) => (b.bookings || 0) - (a.bookings || 0)
        )
      )
    }

    fetchData()
  }, [barberId, month, year])

  if (!data.length)
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
      className="p-2 rounded-lg shadow-md border flex flex-col flex-1"
      style={{
        borderColor: 'var(--card-revenue-border)',
        background: 'var(--card-revenue-bg)',
        minHeight: '360px',
      }}
    >
      <h2 className="text-[#E8EDC7] text-xl font-semibold mb-4">
        💈 Service Breakdown
      </h2>

      <div
        className="flex flex-col md:flex-row gap-2 md:items-center flex-1"
        style={{ overflow: 'hidden' }}
      >
        {/* Chart */}
        <div className="flex-1 flex items-center justify-center min-h-[300px] md:min-h-[320px]">
          <ResponsiveContainer width="100%" height={340}>
            <PieChart>
              <Pie
                data={data}
                dataKey="bookings"
                nameKey="service_name"
                outerRadius="80%"
                innerRadius="45%"
                labelLine={false}
                isAnimationActive={false}
              >
                {data.map((_, index) => (
                  <Cell
                    key={index}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1E1E1C',
                  border: '1px solid #C8B653',
                  borderRadius: '8px',
                  color: '#F5F5DC',
                  padding: '8px 12px',
                }}
                itemStyle={{ color: '#E8EDC7', fontWeight: 500 }}
                labelStyle={{ color: '#C8B653', fontWeight: 600 }}
                formatter={(value, name) => [`${value} bookings`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div
          className="flex flex-wrap md:flex-col gap-3 justify-center md:justify-start md:pl-4 text-[#E8EDC7]"
          style={{
            fontSize: '0.95rem',
            lineHeight: 1.3,
            flexShrink: 0,
          }}
        >
          {data.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-2"
              style={{ minWidth: '110px', wordBreak: 'break-word' }}
            >
              <span
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: COLORS[index % COLORS.length],
                  display: 'inline-block',
                }}
              />
              <span>{item.service_name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
