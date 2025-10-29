'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'

interface MonthlyRevenueCardProps {
  userId: string
  selectedMonth?: string
  year?: number
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

export default function MonthlyRevenueCard({ userId, selectedMonth, year }: MonthlyRevenueCardProps) {
  const [revenue, setRevenue] = useState<number | null>(null)
  const [prevRevenue, setPrevRevenue] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId || !selectedMonth) return

    const fetchRevenue = async () => {
      setLoading(true)
      try {
        const currentYear = year ?? new Date().getFullYear()

        // Current month revenue
        const { data: currentData, error: currentError } = await supabase
          .from('reports')
          .select('total_revenue')
          .eq('user_id', userId)
          .eq('type', 'monthly')
          .eq('month', selectedMonth)
          .eq('year', currentYear)
          .maybeSingle()

        if (currentError) console.error('Error fetching current month revenue:', currentError)
        setRevenue(currentData?.total_revenue ?? null)

        // Previous month revenue
        const currentIndex = MONTHS.indexOf(selectedMonth)
        let prevIndex = currentIndex - 1
        let prevYear = currentYear
        if (prevIndex < 0) {
          prevIndex = 11
          prevYear -= 1
        }
        const prevMonth = MONTHS[prevIndex]

        const { data: prevData, error: prevError } = await supabase
          .from('reports')
          .select('total_revenue')
          .eq('user_id', userId)
          .eq('type', 'monthly')
          .eq('month', prevMonth)
          .eq('year', prevYear)
          .maybeSingle()

        if (prevError) console.error('Error fetching previous month revenue:', prevError)
        setPrevRevenue(prevData?.total_revenue ?? null)
      } catch (err) {
        console.error('Error fetching revenues:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchRevenue()
  }, [userId, selectedMonth, year])

  const calculateChange = () => {
    if (revenue === null || prevRevenue === null) return null
    const diff = revenue - prevRevenue
    const percent = (diff / prevRevenue) * 100
    return Math.round(percent)
  }

  const change = calculateChange()

  return (
    <div className="bg-[#1f1f1a] p-4 rounded-lg shadow-md relative flex flex-col min-h-[120px]">
      {/* Header */}
      <h2 className="text-[#c4d2b8] text-base font-semibold mb-2">💰 Monthly Revenue</h2>

      {/* Revenue middle-left */}
      <div className="flex-1 flex items-center">
        <p className="text-2xl font-bold text-[#F5E6C5]">
          {loading ? 'Loading...' : revenue !== null ? `$${revenue.toLocaleString()}` : 'N/A'}
        </p>
      </div>

      {/* Percentage bottom-left */}
      <div className="flex justify-start mt-auto">
        {change !== null ? (
          <p className={`text-sm font-semibold ${change > 0 ? 'text-green-500' : change < 0 ? 'text-red-500' : 'text-gray-400'}`}>
            {change > 0 ? `+${change}%` : change < 0 ? `${change}%` : '0%'}
          </p>
        ) : (
          <p className="invisible text-sm font-semibold">0%</p>
        )}
      </div>
    </div>
  )
}
