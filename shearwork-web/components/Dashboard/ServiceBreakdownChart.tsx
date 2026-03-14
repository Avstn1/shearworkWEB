'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const COLORS = [
  '#6ee7b7', '#a78bfa', '#67e8f9', '#fbbf24', '#f0abfc',
  '#86efac', '#c4b5fd', '#a5f3fc', '#fcd34d', '#f5d0fe',
  '#bbf7d0', '#ddd6fe', '#cffafe', '#fde68a', '#fae8ff',
  '#d1fae5', '#ede9fe', '#e0f2fe', '#fef3c7', '#fdf4ff',
  '#ecfdf5', '#f5f3ff', '#f0f9ff', '#fffbeb',
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
        className="flex items-center justify-center min-h-[360px]"
      >
        <p className="text-[#555]">No data to see here yet!</p>
      </div>
    )

  // -----------------------------
  // TOP 6 + OTHERS LOGIC
  // -----------------------------
  const TOP_COUNT = 6
  const topServices = data.slice(0, TOP_COUNT)
  const otherServices = data.slice(TOP_COUNT)

  let finalData = topServices

  if (otherServices.length > 0) {
    const otherTotal = otherServices.reduce(
      (sum, item) => sum + (item.bookings || 0),
      0
    )

    finalData = [
      ...topServices,
      { service_name: "Others", bookings: otherTotal },
    ]
  }

  // -----------------------------

  return (
    <div
      className="flex flex-col flex-1"
      style={{
        minHeight: '360px',
      }}
    >
      <h2 className="text-white text-xl font-semibold mb-4">
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
                data={finalData}
                dataKey="bookings"
                nameKey="service_name"
                outerRadius="80%"
                innerRadius="45%"
                labelLine={false}
                isAnimationActive={false}
              >
                {finalData.map((_, index) => (
                  <Cell
                    key={index}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>

              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f1210',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  padding: '8px 12px',
                }}
                itemStyle={{ color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}
                labelStyle={{ color: '#ffffff', fontWeight: 600 }}
                formatter={(value, name) => [`${value} bookings`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div
          className="flex flex-wrap md:flex-col gap-3 justify-center md:justify-start md:pl-4 text-[#8a9b90]"
          style={{
            fontSize: '0.95rem',
            lineHeight: 1.3,
            flexShrink: 0,
          }}
        >
          {finalData.map((item, index) => (
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