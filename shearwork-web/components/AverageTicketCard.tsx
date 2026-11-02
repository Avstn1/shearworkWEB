'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { Stat } from '@/components/ui/AppKit'

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
        const monthIndex = MONTHS.indexOf(selectedMonth)

        const { data: currentMonthRow, error: currentError } = await supabase
          .from('monthly_data')
          .select('total_revenue, tips, num_appointments')
          .eq('user_id', userId)
          .eq('month', selectedMonth)
          .eq('year', currentYear)
          .maybeSingle()

        if (currentError) {
          console.error('Error fetching current month summary:', currentError)
        }

        if (currentMonthRow && Number(currentMonthRow.num_appointments || 0) > 0) {
          const totalRevenue = Number(currentMonthRow.total_revenue || 0)
          const totalTips = Number(currentMonthRow.tips || 0)
          const count = Number(currentMonthRow.num_appointments || 0)
          setAvgTicket((totalRevenue + totalTips) / count)
        } else {
          setAvgTicket(null)
        }

        // Determine previous month/year
        let prevMonthIndex = monthIndex - 1
        let prevYear = currentYear
        if (prevMonthIndex < 0) {
          prevMonthIndex = 11
          prevYear -= 1
        }

        const prevMonthName = MONTHS[prevMonthIndex]

        const { data: prevMonthRow, error: prevError } = await supabase
          .from('monthly_data')
          .select('total_revenue, tips, num_appointments')
          .eq('user_id', userId)
          .eq('month', prevMonthName)
          .eq('year', prevYear)
          .maybeSingle()

        if (prevError) {
          console.error('Error fetching previous month summary:', prevError)
        }

        if (prevMonthRow && Number(prevMonthRow.num_appointments || 0) > 0) {
          const prevTotalRevenue = Number(prevMonthRow.total_revenue || 0)
          const prevTotalTips = Number(prevMonthRow.tips || 0)
          const count = Number(prevMonthRow.num_appointments || 0)
          setPrevAvgTicket((prevTotalRevenue + prevTotalTips) / count)
        } else {
          setPrevAvgTicket(null)
        }

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
    <div className="flex h-full w-full flex-col">
      <Stat
        label="Avg Ticket"
        value={
          loading ? (
            <span className="text-base font-medium text-gray-500">Loading…</span>
          ) : avgTicket !== null ? (
            formatCurrency(avgTicket)
          ) : (
            'N/A'
          )
        }
        delta={change}
        hint={<span>{change !== null ? 'vs. prior month' : 'No prior month data'}</span>}
      />
    </div>
  )
}
