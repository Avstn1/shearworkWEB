'use client'

import React, { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { supabase } from '@/utils/supabaseClient'

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
      className="p-4 rounded-lg shadow-md border border-[color:var(--card-revenue-border)] flex flex-col h-[340px]"
      style={{ background: 'var(--card-revenue-bg)' }}
    >
      <h2 className="text-[#E8EDC7] text-base font-semibold mb-4">📣 Marketing Funnels</h2>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="source" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="new_clients" name="New Clients" fill="#82ca9d" />
          <Bar dataKey="returning_clients" name="Returning" fill="#8884d8" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
