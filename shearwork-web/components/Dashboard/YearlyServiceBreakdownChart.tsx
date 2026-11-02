'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { PieChart as PieIcon } from 'lucide-react'
import { EmptyState } from '@/components/ui/AppKit'

// Graphite chart palette (series order); index 6 ("Others") is a neutral grey.
const COLORS = ['#8FB57A', '#A9C0D2', '#D8C59A', '#B8BCB5', '#D99A8B', '#6F8F63', '#5C615B']

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
      <div className="flex min-h-[360px] flex-col">
        <h2 className="panel-title">{timeframeLabel(timeframe, year)}</h2>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-gray-500">Loading service breakdown…</p>
        </div>
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="flex min-h-[360px] flex-col">
        <h2 className="panel-title">{timeframeLabel(timeframe, year)}</h2>
        <div className="flex flex-1 items-center justify-center">
          <EmptyState icon={PieIcon} title="No service data for this timeframe" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[360px] flex-1 flex-col">
      <h2 className="panel-title mb-4">{timeframeLabel(timeframe, year)}</h2>

      <div className="flex flex-1 flex-col gap-4 overflow-hidden md:flex-row md:items-center">
        {/* Chart */}
        <div className="flex min-h-[280px] flex-1 items-center justify-center md:min-h-[320px]">
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={data}
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
                {data.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
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
                formatter={(value, name) => [`${value} bookings`, name as string]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <ul className="flex shrink-0 flex-wrap justify-center gap-x-4 gap-y-2 text-[13px] text-gray-300 md:flex-col md:justify-start md:pl-2">
          {data.map((item, index) => (
            <li key={index} className="flex min-w-[110px] items-center gap-2 break-words">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
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
