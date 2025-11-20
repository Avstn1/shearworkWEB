'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'

type Timeframe = 'year' | 'Q1' | 'Q2' | 'Q3' | 'Q4'

interface Props {
  userId: string
  year: number
  timeframe: Timeframe
}

function getDateRange(timeframe: Timeframe, year: number) {
  switch (timeframe) {
    case 'Q1':
      return { start: `${year}-01-01`, end: `${year}-03-31` }
    case 'Q2':
      return { start: `${year}-04-01`, end: `${year}-06-30` }
    case 'Q3':
      return { start: `${year}-07-01`, end: `${year}-09-30` }
    case 'Q4':
      return { start: `${year}-10-01`, end: `${year}-12-31` }
    case 'year':
    default:
      return { start: `${year}-01-01`, end: `${year}-12-31` }
  }
}

export default function YearlyExpensesCard({ userId, year, timeframe }: Props) {
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return

    const fetchData = async () => {
      setLoading(true)
      try {
        // YEAR → use yearly_expenses table (same as before)
        if (timeframe === 'year') {
          const { data, error } = await supabase
            .from('yearly_expenses')
            .select('total_expenses')
            .eq('user_id', userId)
            .eq('year', year)
            .maybeSingle()

          if (error) throw error
          setTotal(data?.total_expenses ?? 0)
          return
        }

        // QUARTERS → sum expenses from daily_data within date range
        const { start, end } = getDateRange(timeframe, year)

        const { data: rows, error } = await supabase
          .from('daily_data')
          .select('expenses')
          .eq('user_id', userId)
          .gte('date', start)
          .lte('date', end)

        if (error) throw error

        let sum = 0
        ;(rows ?? []).forEach((r: any) => {
          sum += Number(r.expenses) || 0
        })

        setTotal(sum)
      } catch (err) {
        console.error('Error fetching timeframe expenses:', err)
        setTotal(null)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [userId, year, timeframe])

  const formatCurrency = (n: number) =>
    `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const titleSuffix = timeframe === 'year' ? 'YTD' : timeframe

  return (
    <div
      className="flex flex-col justify-between rounded-lg shadow-md border border-[color:var(--card-revenue-border)]"
      style={{
        background: 'var(--card-revenue-bg)',
        height: '100%',
        minHeight: '150px',
        maxHeight: '200px',
        padding: '1rem',
      }}
    >
      <h2 className="text-[#E8EDC7] text-base font-semibold mb-2">
        💸 Total Expenses ({titleSuffix})
      </h2>
      <div className="flex-1 flex items-center justify-start">
        <p className="text-3xl font-bold text-[#F5E6C5] truncate">
          {loading ? 'Loading...' : total !== null ? formatCurrency(total) : 'N/A'}
        </p>
      </div>
    </div>
  )
}
