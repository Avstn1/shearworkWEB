'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'

type Timeframe = 'year' | 'Q1' | 'Q2' | 'Q3' | 'Q4'

interface TimeframeAverageTicketCardProps {
  userId: string
  year: number
  timeframe: Timeframe
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const QUARTER_MONTHS: Record<Timeframe, { startMonth: number; endMonth: number }> = {
  year: { startMonth: 1, endMonth: 12 },
  Q1: { startMonth: 1, endMonth: 3 },
  Q2: { startMonth: 4, endMonth: 6 },
  Q3: { startMonth: 7, endMonth: 9 },
  Q4: { startMonth: 10, endMonth: 12 },
}

export default function TimeframeAverageTicketCard({
  userId,
  year,
  timeframe,
}: TimeframeAverageTicketCardProps) {
  const [avgTicket, setAvgTicket] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId || !year) return

    const fetchAvgTicket = async () => {
      setLoading(true)
      try {
        const { startMonth, endMonth } = QUARTER_MONTHS[timeframe]
        const monthRange = MONTHS.slice(startMonth - 1, endMonth)

        const { data: rows, error } = await supabase
          .from('monthly_data')
          .select('total_revenue, tips, num_appointments')
          .eq('user_id', userId)
          .eq('year', year)
          .in('month', monthRange)

        if (error) throw error

        if (!rows || rows.length === 0) {
          setAvgTicket(null)
          return
        }

        const totals = rows.reduce(
          (acc, row) => {
            acc.revenue += Number(row.total_revenue || 0)
            acc.tips += Number(row.tips || 0)
            acc.appointments += Number(row.num_appointments || 0)
            return acc
          },
          { revenue: 0, tips: 0, appointments: 0 }
        )

        if (totals.appointments === 0) {
          setAvgTicket(null)
          return
        }

        setAvgTicket((totals.revenue + totals.tips) / totals.appointments)
      } catch (err) {
        console.error('Error fetching timeframe avg_ticket:', err)
        setAvgTicket(null)
      } finally {
        setLoading(false)
      }
    }

    fetchAvgTicket()
  }, [userId, year, timeframe])

  const formatCurrency = (amount: number) =>
    `$${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`

  const titleSuffix =
    timeframe === 'year' ? 'YTD' : timeframe

  return (
    <div
      className="p-4 rounded-lg shadow-md border border-[color:var(--card-revenue-border)] flex flex-col min-h-[140px]"
      style={{ background: 'var(--card-revenue-bg)' }}
    >
      <h2 className="text-[#E8EDC7] text-base font-semibold mb-2">
        💵 Avg Ticket ({titleSuffix})
      </h2>

      <div className="flex-1 flex items-center">
        <p className="text-3xl font-bold text-[#F5E6C5] truncate">
          {loading
            ? 'Loading...'
            : avgTicket !== null
              ? formatCurrency(avgTicket)
              : 'N/A'}
        </p>
      </div>

      {/* no percent-change footer for timeframe view */}
    </div>
  )
}