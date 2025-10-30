'use client'

import React from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const COLORS = ['#82ca9d', '#8884d8', '#ffc658', '#ff7f7f']

interface ServiceBreakdownChartProps {
  data?: {
    name: string
    bookings: number
    percent: number
  }[]
}

// Default static data for now
const defaultData = [
  { name: 'Haircut', bookings: 208, percent: 78.5 },
  { name: 'Hair & Beard', bookings: 39, percent: 14.7 },
  { name: 'Kids Haircut', bookings: 17, percent: 6.4 },
  { name: 'Line-Up', bookings: 1, percent: 0.4 },
]

export default function ServiceBreakdownChart({ data = defaultData }: ServiceBreakdownChartProps) {
  return (
    <div
      className="p-4 rounded-lg shadow-md border border-[color:var(--card-revenue-border)] flex flex-col h-[340px]"
      style={{ background: 'var(--card-revenue-bg)' }}
    >
      <h2 className="text-[#E8EDC7] text-base font-semibold mb-4">💈 Service Breakdown</h2>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="bookings"
            nameKey="name"
            outerRadius={100}
            label
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
