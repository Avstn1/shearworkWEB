'use client'

import React, { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
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

export default function MarketingFunnelsChart({ barberId, month, year }: MarketingFunnelsChartProps) {
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

      setData(funnels as MarketingFunnel[])
    }

    fetchData()
  }, [barberId, month, year])

  if (data.length === 0) return <p>Loading marketing data...</p>

  return (
    <div
      className="p-4 rounded-lg shadow-md border border-[color:var(--card-revenue-border)] flex flex-col"
      style={{
        background: 'var(--card-revenue-bg)',
        height: '360px',
        overflow: 'visible',
      }}
    >
      <h2 className="text-[#E8EDC7] text-xl font-semibold mb-4">
        📣 Marketing Funnels
      </h2>

      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#3A3A3A" />
          <XAxis dataKey="source" stroke="#E8EDC7" />
          <YAxis stroke="#E8EDC7" />
          <Tooltip
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
            iconType="circle"
            wrapperStyle={{
              color: '#E8EDC7',
              paddingTop: '10px',
            }}
          />
          <Bar
            dataKey="new_clients"
            name="New Clients"
            fill={COLORS[1]}
            radius={[8, 8, 0, 0]}
          />
          <Bar
            dataKey="returning_clients"
            name="Returning Clients"
            fill={COLORS[3]}
            radius={[8, 8, 0, 0]}
          />
          <Bar
            dataKey="retention"
            name="Retention"
            fill={COLORS[2]}
            radius={[8, 8, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
