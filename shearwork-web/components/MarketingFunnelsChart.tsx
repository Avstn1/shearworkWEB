'use client'

import React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

interface MarketingFunnelsChartProps {
  data?: {
    source: string
    newClients: number
    returning: number
    retention: number
    avgTicket: number
  }[]
}

// Default static data for now
const defaultData = [
  { source: 'Instagram', newClients: 11, returning: 6, retention: 55, avgTicket: 52 },
  { source: 'Referral', newClients: 6, returning: 2, retention: 33, avgTicket: 54 },
  { source: 'Google / Walk-In', newClients: 0, returning: 0, retention: 0, avgTicket: 0 },
]

export default function MarketingFunnelsChart({ data = defaultData }: MarketingFunnelsChartProps) {
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
          <Bar dataKey="newClients" name="New Clients" fill="#82ca9d" />
          <Bar dataKey="returning" name="Returning" fill="#8884d8" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
