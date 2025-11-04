'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'

interface AvgTicketCardProps {
  userId: string
  selectedMonth?: string
  year?: number
}

export default function AverageTicketCard({ userId, selectedMonth, year }: AvgTicketCardProps) {
  const [avgTicket, setAvgTicket] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId || !selectedMonth) return

    const fetchAvgTicket = async () => {
      setLoading(true)
      try {
        const currentYear = year ?? new Date().getFullYear()

        // ✅ Query monthly_data table instead of reports
        const { data, error } = await supabase
          .from('monthly_data') // ← changed
          .select('avg_ticket, created_at')
          .eq('user_id', userId)
          .eq('month', selectedMonth)
          .eq('year', currentYear)
          .order('created_at', { ascending: false })
          .limit(1)
          .single() // we expect exactly one or none

        if (error) {
          console.warn('Supabase error fetching average ticket:', error.message)
          setAvgTicket(null)
          return
        }

        if (!data) {
          console.warn(`No monthly data found for ${selectedMonth} ${currentYear}`)
          setAvgTicket(null)
          return
        }

        setAvgTicket(data.avg_ticket ?? null)
      } catch (err: any) {
        console.error('Unexpected error fetching average ticket:', err?.message ?? err)
        setAvgTicket(null)
      } finally {
        setLoading(false)
      }
    }

    fetchAvgTicket()
  }, [userId, selectedMonth, year])

  const formatCurrency = (amount: number) =>
    `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div
      className="p-4 rounded-lg shadow-md border border-[color:var(--card-revenue-border)] flex flex-col min-h-[140px]"
      style={{ background: 'var(--card-revenue-bg)' }}
    >
      <h2 className="text-[#E8EDC7] text-base font-semibold mb-2">💵 Avg Ticket</h2>

      <div className="flex-1 flex items-center">
        <p className="text-3xl font-bold text-[#F5E6C5]">
          {loading
            ? 'Loading...'
            : avgTicket !== null
              ? formatCurrency(avgTicket)
              : 'N/A'}
        </p>
      </div>
    </div>
  )
}
