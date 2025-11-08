'use client'

import React, { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from 'recharts'
import { supabase } from '@/utils/supabaseClient'

// 💈 Theme colors matching your app
const COLORS = ['#E8EDC7', '#9AC8CD', '#B19470', '#748E63', '#F1EEDC']

export interface MarketingFunnel {
  source: string
  new_clients: number
  returning_clients: number
  retention: number
  avg_ticket: number
  [key: string]: string | number | undefined
}

interface MarketingFunnelsChartProps {
  barberId: string
  month: string
  year: number
}

export default function MarketingFunnelsChart({
  barberId,
  month,
  year,
}: MarketingFunnelsChartProps) {
  const [data, setData] = useState<MarketingFunnel[]>([])

  useEffect(() => {
    const fetchData = async () => {
      const { data: funnels, error } = await supabase
        .from('marketing_funnels')
        .select('source, new_clients, returning_clients, retention, avg_ticket')
        .eq('user_id', barberId)
        .eq('report_month', month)
        .eq('report_year', year)

      if (error) {
        console.error('Error fetching marketing funnels:', error)
        return
      }

      const filtered = (funnels as MarketingFunnel[]).filter(
        (f) =>
          f.source &&
          f.source !== 'Unknown' &&
          f.source !== 'Returning Client'
      )

      setData(filtered)
    }

    fetchData()
  }, [barberId, month, year])

  if (data.length === 0)
    return (
      <div
        className="p-4 rounded-lg shadow-md border flex items-center justify-center min-h-[400px]"
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
        minHeight: '400px',
        maxHeight: '440px',
        overflow: 'visible',
      }}
    >
      <h2 className="text-[#E8EDC7] text-xl font-semibold mb-4">
        📣 Marketing Funnels
      </h2>

      <div className="flex-1 flex items-center justify-center overflow-visible">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 20, right: 20, left: 0, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#3A3A3A" />

            <XAxis
              dataKey="source"
              stroke="#E8EDC7"
              angle={-35}
              textAnchor="end"
              interval={0}
              height={60}
              style={{ fontSize: '12px' }}
            />
            <YAxis stroke="#E8EDC7" />

            <Tooltip
              formatter={(value: any, name: string) => {
                if (name === 'Retention') return [`${value}%`, name]
                return [value, name]
              }}
              contentStyle={{
                backgroundColor: '#2b2b2b',
                border: '1px solid #E8EDC7',
                borderRadius: '8px',
                color: '#E8EDC7',
              }}
              itemStyle={{ color: '#E8EDC7' }}
              labelStyle={{ color: '#E8EDC7' }}
            />

            <Legend
              formatter={(value) =>
                value === 'Retention' ? 'Retention (%)' : value
              }
              iconType="circle"
              wrapperStyle={{
                color: '#E8EDC7',
                paddingTop: '10px',
              }}
            />

            {/* New Clients Bar with numbers */}
            <Bar
              dataKey="new_clients"
              name="New Clients"
              fill={COLORS[1]}
              radius={[8, 8, 0, 0]}
            >
              <LabelList
                dataKey="new_clients"
                position="top"
                style={{ fill: '#E8EDC7', fontSize: 12, fontWeight: 'bold' }}
              />
            </Bar>

            {/* Returning Clients Bar with numbers */}
            <Bar
              dataKey="returning_clients"
              name="Returning Clients"
              fill={COLORS[3]}
              radius={[8, 8, 0, 0]}
            >
              <LabelList
                dataKey="returning_clients"
                position="top"
                style={{ fill: '#E8EDC7', fontSize: 12, fontWeight: 'bold' }}
              />
            </Bar>

            {/* Retention Bar with percentages */}
            <Bar
              dataKey="retention"
              name="Retention"
              fill={COLORS[2]}
              radius={[8, 8, 0, 0]}
            >
              <LabelList
                dataKey="retention"
                position="top"
                formatter={(val) => `${val}%`}
                style={{ fill: '#E8EDC7', fontSize: 12, fontWeight: 'bold' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
