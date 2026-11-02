'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { PieChart as PieIcon } from 'lucide-react'
import { EmptyState, PanelHeading } from '@/components/ui/AppKit'

// Graphite chart palette (series order); "Others" falls back to a neutral grey.
const COLORS = ['#8FB57A', '#A9C0D2', '#D8C59A', '#B8BCB5', '#D99A8B', '#6F8F63']
const OTHERS_COLOR = '#5C615B'

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
      <div className="flex min-h-[360px] flex-col lg:h-full lg:min-h-0">
        <PanelHeading icon={PieIcon} tone="sage">Service breakdown</PanelHeading>
        <div className="flex flex-1 items-center justify-center">
          <EmptyState icon={PieIcon} title="No data to see here yet" />
        </div>
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

  const colorFor = (index: number, name: string) =>
    name === 'Others' && otherServices.length > 0 ? OTHERS_COLOR : COLORS[index % COLORS.length]

  return (
    <div className="flex min-h-[360px] flex-1 flex-col lg:h-full lg:min-h-0">
      <PanelHeading icon={PieIcon} tone="sage" className="mb-4">Service breakdown</PanelHeading>

      <div className="flex flex-1 flex-col gap-4 overflow-hidden md:flex-row md:items-center">
        {/* Chart */}
        <div className="flex min-h-[280px] flex-1 items-center justify-center md:min-h-[320px] lg:min-h-0">
          <ResponsiveContainer width="100%" height="100%" minHeight={200}>
            <PieChart>
              <Pie
                data={finalData}
                dataKey="bookings"
                nameKey="service_name"
                outerRadius="80%"
                innerRadius="55%"
                paddingAngle={1}
                stroke="#171A18"
                strokeWidth={2}
                labelLine={false}
                isAnimationActive={false}
              >
                {finalData.map((item, index) => (
                  <Cell key={index} fill={colorFor(index, String(item.service_name))} />
                ))}
              </Pie>

              <Tooltip
                contentStyle={{
                  backgroundColor: '#1D201E',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8,
                  color: '#ECEDEA',
                  padding: '8px 12px',
                  fontSize: 12,
                }}
                itemStyle={{ color: '#ECEDEA', fontWeight: 500 }}
                labelStyle={{ color: '#9EA39C', fontWeight: 600 }}
                formatter={(value, name) => [`${value} bookings`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <ul className="flex shrink-0 flex-wrap justify-center gap-x-4 gap-y-2 text-[13px] text-gray-300 md:flex-col md:justify-start md:pl-2">
          {finalData.map((item, index) => (
            <li key={index} className="flex min-w-[110px] items-center gap-2 break-words">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: colorFor(index, String(item.service_name)) }}
              />
              <span className="min-w-0 flex-1">{item.service_name}</span>
              <span className="tabular-nums text-gray-500">{item.bookings}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
