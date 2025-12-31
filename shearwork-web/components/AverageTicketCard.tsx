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
        const monthIndex = MONTHS.indexOf(selectedMonth)

        // Build date range for current month
        const startDate = `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}-01`
        const endDate = monthIndex === 11 
          ? `${currentYear + 1}-01-01`
          : `${currentYear}-${String(monthIndex + 2).padStart(2, '0')}-01`

        // Fetch current month from acuity_appointments
        const { data: currentAppts, error: currentError } = await supabase
          .from('acuity_appointments')
          .select('revenue, tip')
          .eq('user_id', userId)
          .gte('appointment_date', startDate)
          .lt('appointment_date', endDate)

        if (currentError) {
          console.error('Error fetching current appointments:', currentError)
        }

        // Calculate average ticket (revenue + tips) / count
        if (currentAppts && currentAppts.length > 0) {
          const totalRevenue = currentAppts.reduce((sum, appt) => sum + (appt.revenue || 0), 0)
          const totalTips = currentAppts.reduce((sum, appt) => sum + (appt.tip || 0), 0)
          const total = totalRevenue + totalTips
          setAvgTicket(total / currentAppts.length)
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

        // Build date range for previous month
        const prevStartDate = `${prevYear}-${String(prevMonthIndex + 1).padStart(2, '0')}-01`
        const prevEndDate = prevMonthIndex === 11 
          ? `${prevYear + 1}-01-01`
          : `${prevYear}-${String(prevMonthIndex + 2).padStart(2, '0')}-01`

        // Fetch previous month from acuity_appointments
        const { data: prevAppts, error: prevError } = await supabase
          .from('acuity_appointments')
          .select('revenue, tip')
          .eq('user_id', userId)
          .gte('appointment_date', prevStartDate)
          .lt('appointment_date', prevEndDate)

        if (prevError) {
          console.error('Error fetching previous appointments:', prevError)
        }

        // Calculate previous month average ticket
        if (prevAppts && prevAppts.length > 0) {
          const prevTotalRevenue = prevAppts.reduce((sum, appt) => sum + (appt.revenue || 0), 0)
          const prevTotalTips = prevAppts.reduce((sum, appt) => sum + (appt.tip || 0), 0)
          const prevTotal = prevTotalRevenue + prevTotalTips
          setPrevAvgTicket(prevTotal / prevAppts.length)
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