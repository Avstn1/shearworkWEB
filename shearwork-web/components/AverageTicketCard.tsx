
'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'

interface AvgTicketCardProps {
  userId: string
  selectedMonth?: string
  year?: number | null
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

export default function AverageTicketCard({ userId, selectedMonth, year }: AvgTicketCardProps) {
  const [avgTicket, setAvgTicket] = useState<number | null>(null)
  const [prevAvgTicket, setPrevAvgTicket] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId || !selectedMonth) return

    const fetchAvgTicket = async () => {
      setLoading(true)
      try {
        const currentYear = year ?? new Date().getFullYear()

        // ✅ Fetch current month avg_ticket from monthly_data
        const { data: currentData, error: currentError } = await supabase
          .from('monthly_data')
          .select('avg_ticket')
          .eq('user_id', userId)
          .eq('month', selectedMonth)
          .eq('year', currentYear)
          .maybeSingle()

        if (currentError) console.error('Error fetching current avg_ticket:', currentError)
        setAvgTicket(currentData?.avg_ticket ?? null)

        // ✅ Determine previous month/year
        const currentIndex = MONTHS.indexOf(selectedMonth)
        let prevIndex = currentIndex - 1
        let prevYear = currentYear
        if (prevIndex < 0) {
          prevIndex = 11
          prevYear -= 1
        }
        const prevMonth = MONTHS[prevIndex]

        // ✅ Fetch previous month avg_ticket
        const { data: prevData, error: prevError } = await supabase
          .from('monthly_data')
          .select('avg_ticket')
          .eq('user_id', userId)
          .eq('month', prevMonth)
          .eq('year', prevYear)
          .maybeSingle()

        if (prevError) console.error('Error fetching previous avg_ticket:', prevError)
        setPrevAvgTicket(prevData?.avg_ticket ?? null)
      } catch (err) {
        console.error('Error fetching average tickets:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchAvgTicket()
  }, [userId, selectedMonth, year])

  const formatCurrency = (amount: number) =>
    `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const calculateChange = (): number | null => {
    if (avgTicket === null || prevAvgTicket === null || prevAvgTicket === 0) return null
    const diff = avgTicket - prevAvgTicket
    const percent = (diff / prevAvgTicket) * 100
    return parseFloat(percent.toFixed(2))
  }

  const change = calculateChange()

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

      <div className="flex justify-start mt-auto">
        {change !== null ? (
          <p
            className={`text-sm font-semibold ${
              change > 0
                ? 'text-green-400'
                : change < 0
                  ? 'text-red-400'
                  : 'text-gray-400'
            }`}
          >
            {change > 0 ? `+${change.toFixed(2)}%` : `${change.toFixed(2)}%`} <span className="text-gray-400">(vs. prior month)</span>
          </p>
        ) : (
          <p className="text-sm text-gray-500">—</p>
        )}
      </div>
    </div>
  )
}
