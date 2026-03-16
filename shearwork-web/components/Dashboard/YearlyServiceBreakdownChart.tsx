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

type Timeframe = 'year' | 'Q1' | 'Q2' | 'Q3' | 'Q4'

interface YearlyServiceBreakdownChartProps {
  barberId: string
  year: number
  timeframe: Timeframe
}

const ALL_MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const MONTHS_BY_QUARTER: Record<Exclude<Timeframe, 'year'>, string[]> = {
  Q1: ['January', 'February', 'March'],
  Q2: ['April', 'May', 'June'],
  Q3: ['July', 'August', 'September'],
  Q4: ['October', 'November', 'December'],
}

const timeframeLabel = (timeframe: Timeframe, year: number) => {
  if (timeframe === 'year') return `Service Breakdown (${year})`
  switch (timeframe) {
    case 'Q1': return `Service Breakdown (Q1 • Jan–Mar ${year})`
    case 'Q2': return `Service Breakdown (Q2 • Apr–Jun ${year})`
    case 'Q3': return `Service Breakdown (Q3 • Jul–Sep ${year})`
    case 'Q4': return `Service Breakdown (Q4 • Oct–Dec ${year})`
  }
}

export default function YearlyServiceBreakdownChart({
  barberId,
  year,
  timeframe,
}: YearlyServiceBreakdownChartProps) {
  const [data, setData] = useState<ServiceBooking[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    if (!barberId || !year) return

    const fetchData = async () => {
      setLoading(true)
      try {
        const monthsToUse =
          timeframe === 'year'
            ? ALL_MONTHS
            : MONTHS_BY_QUARTER[timeframe]

        const { data: bookings, error } = await supabase
          .from('service_bookings')
          .select('service_name, bookings, report_month')
          .eq('user_id', barberId)
          .eq('report_year', year)
          .in('report_month', monthsToUse)

        if (error) {
          console.error('Error fetching yearly service breakdown:', error)
          setData([])
          return
        }

        // Aggregate bookings per service across all selected months
        const totals: Record<string, number> = {}

        ;(bookings ?? []).forEach((row: any) => {
          const name = row.service_name ?? 'Unknown'
          const count = Number(row.bookings) || 0
          totals[name] = (totals[name] ?? 0) + count
        })

        const sorted: ServiceBooking[] = Object.entries(totals)
          .map(([service_name, bookings]) => ({
            service_name,
            bookings,
          }))
          .sort((a, b) => (b.bookings || 0) - (a.bookings || 0))

        // Take top 6, group the rest into "Others"
        let aggregated: ServiceBooking[]
        if (sorted.length <= 6) {
          aggregated = sorted
        } else {
          const top6 = sorted.slice(0, 6)
          const others = sorted.slice(6)
          const othersTotal = others.reduce((sum, item) => sum + (item.bookings || 0), 0)
          
          aggregated = [
            ...top6,
            { service_name: 'Others', bookings: othersTotal }
          ]
        }

        setData(aggregated)
      } catch (err) {
        console.error('Error preparing yearly service breakdown:', err)
        setData([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [barberId, year, timeframe])

  if (loading) {
    return (
      <div
        className="flex items-center justify-center min-h-[360px]"
      >
        <p className="text-[#555]">Loading service breakdown...</p>
      </div>
    )
  }

  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center min-h-[360px]"
      >
        <p className="text-[#555]">
          No service data for this timeframe.
        </p>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col flex-1"
      style={{
        minHeight: '360px',
      }}
    >
      <h2 className="text-white text-xl font-semibold mb-4">
        💈 {timeframeLabel(timeframe, year)}
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
                  backgroundColor: '#0f1210',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  padding: '8px 12px',
                }}
                itemStyle={{ color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}
                labelStyle={{ color: '#ffffff', fontWeight: 600 }}
                formatter={(value, name) => [`${value} bookings`, name as string]}
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