'use client'

import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { supabase } from '@/utils/supabaseClient'

interface ProfitMarginPieChartProps {
  userId: string
  selectedMonth: string
  selectedYear: number
  refreshKey?: number // optional prop to force refresh
}

export default function ProfitMarginPieChart({
  userId,
  selectedMonth,
  selectedYear,
  refreshKey,
}: ProfitMarginPieChartProps) {
  const [data, setData] = useState<{ name: string; value: number }[]>([])

  useEffect(() => {
    const fetchData = async () => {
      if (!userId || !selectedMonth || !selectedYear) return

      // Fetch aggregated revenue and expenses for this month
      const { data: monthly, error } = await supabase
        .from('monthly_data')
        .select('final_revenue, expenses')
        .eq('user_id', userId)
        .eq('month', selectedMonth)
        .eq('year', selectedYear)
        .maybeSingle()

      if (error) {
        console.error('❌ Error fetching monthly data:', error)
        setData([])
        return
      }

      const revenue = Number(monthly?.final_revenue || 0)
      const expenses = Number(monthly?.expenses || 0)
      const profit = Math.max(revenue - expenses, 0)

      setData([
        { name: 'Profit', value: profit },
        { name: 'Expenses', value: expenses },
      ])
    }

    fetchData()
  }, [userId, selectedMonth, selectedYear, refreshKey])

  const COLORS = ['#8FB57A', '#D99A8B']

  if (data.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-white/[0.07]">
        <p className="text-sm text-gray-500">
          No data yet for {selectedMonth}
        </p>
      </div>
    )
  }

  return (
    <div className="w-full h-64">
      <h2 className="panel-title mb-3">
        Profit vs Expenses
      </h2>
      <ResponsiveContainer width="100%" height="90%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={80}
            innerRadius={50}
            stroke="#171A18"
            strokeWidth={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [`$${value.toFixed(2)}`, name]}
            contentStyle={{
              backgroundColor: '#1D201E',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8,
              color: '#ECEDEA',
              fontSize: 12,
            }}
            itemStyle={{ color: '#ECEDEA' }}
            labelStyle={{ color: '#9EA39C', fontWeight: 600 }}
          />
          <Legend iconType="square" wrapperStyle={{ color: '#9EA39C', fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
