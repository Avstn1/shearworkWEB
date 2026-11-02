'use client'

import { Scissors } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { Stat } from '@/components/ui/AppKit'

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
    <div className="flex h-full w-full flex-col">
      <Stat icon={Scissors} tone="sky"
        label={`Avg Ticket (${titleSuffix})`}
        value={
          loading ? (
            <span className="text-base font-medium text-gray-500">Loading…</span>
          ) : avgTicket !== null ? (
            <span className="block truncate">{formatCurrency(avgTicket)}</span>
          ) : (
            'N/A'
          )
        }
      />
      {/* no percent-change footer for timeframe view */}
    </div>
  )
}
