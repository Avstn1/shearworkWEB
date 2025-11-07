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

  const COLORS = ['#aeea00', '#ff6d00']

  if (data.length === 0) {
    return (
      <div className="p-4 rounded-lg shadow-md border flex items-center justify-center min-h-[200px]"
        style={{
          borderColor: 'var(--card-revenue-border)',
          background: 'var(--card-revenue-bg)',
        }}
      >
        <p className="text-[#E8EDC7] opacity-70 text-sm">
          No data yet for {selectedMonth}
        </p>
      </div>
    )
  }

  return (
    <div className="w-full h-64">
      <h2 className="text-[#c4d2b8] font-semibold mb-2 text-sm sm:text-lg">
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
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [`$${value.toFixed(2)}`, name]}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
