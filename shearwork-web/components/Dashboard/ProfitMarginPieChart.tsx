'use client'

import { useEffect, useState } from 'react'
import { PieChart as PieIcon } from 'lucide-react'
import { PanelHeading } from '@/components/ui/AppKit'
import DonutBreakdown from '@/components/ui/DonutBreakdown'
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
    <div className="flex w-full flex-col">
      <PanelHeading icon={PieIcon} tone="sky" className="mb-4">Profit vs expenses</PanelHeading>
      <DonutBreakdown
        items={data}
        formatValue={v => `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
        totalLabel="Total"
      />
    </div>
  )
}
