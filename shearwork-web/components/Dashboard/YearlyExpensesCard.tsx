'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'

interface Props {
  userId: string
  year: number
}

export default function YearlyExpensesCard({ userId, year }: Props) {
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    const fetchData = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('yearly_expenses')
          .select('total_expenses')
          .eq('user_id', userId)
          .eq('year', year)
          .maybeSingle()
        if (error) throw error
        setTotal(data?.total_expenses ?? 0)
      } catch (err) {
        console.error('Error fetching yearly expenses:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [userId, year])

  const formatCurrency = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`

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
      <h2 className="text-[#E8EDC7] text-base font-semibold mb-2">💸 Total Expenses (YTD)</h2>
      <div className="flex-1 flex items-center justify-start">
        <p className="text-3xl font-bold text-[#F5E6C5] truncate">
          {loading ? 'Loading...' : total !== null ? formatCurrency(total) : 'N/A'}
        </p>
      </div>
    </div>
  )
}
