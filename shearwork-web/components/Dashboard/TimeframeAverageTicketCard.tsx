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
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

const QUARTER_MONTHS: Record<Exclude<Timeframe, 'year'>, string[]> = {
  Q1: ['January', 'February', 'March'],
  Q2: ['April', 'May', 'June'],
  Q3: ['July', 'August', 'September'],
  Q4: ['October', 'November', 'December'],
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
        const query = supabase
          .from('monthly_data')
          .select('month, avg_ticket')
          .eq('user_id', userId)
          .eq('year', year)

        // If a quarter is selected, limit to those months
        if (timeframe !== 'year') {
          query.in('month', QUARTER_MONTHS[timeframe])
        }

        const { data, error } = await query
        if (error) throw error

        const rows = (data ?? []).filter((r: any) => r.avg_ticket !== null)

        if (!rows.length) {
          setAvgTicket(null)
          return
        }

        // Simple average of monthly avg_ticket values in this timeframe
        const sum = rows.reduce(
          (acc: number, r: any) => acc + Number(r.avg_ticket),
          0
        )
        const avg = sum / rows.length

        setAvgTicket(avg)
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
