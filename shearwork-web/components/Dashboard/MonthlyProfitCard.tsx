'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { useBarberLabel } from '@/hooks/useBarberLabel'

interface MonthlyProfitCardProps {
  userId: string
  selectedMonth?: string
  year?: number | null
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

export default function MonthlyProfitCard({ userId, selectedMonth, year }: MonthlyProfitCardProps) {
  const [profit, setProfit] = useState<number | null>(null)
  const [prevProfit, setPrevProfit] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [barberType, setBarberType] = useState<'rental' | 'commission' | undefined>()
  const { label } = useBarberLabel(barberType)

  useEffect(() => {
    if (!userId || !selectedMonth) return

    const fetchBarberType = async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, barber_type')
          .eq('user_id', userId)
          .maybeSingle()

        if (profile?.role?.toLowerCase() === 'barber') {
          setBarberType(profile.barber_type ?? 'commission')
        }
      } catch (err) {
        console.error('Error fetching barber type:', err)
      }
    }

    fetchBarberType()
  }, [userId])

  useEffect(() => {
    if (!userId || !selectedMonth) return

    const fetchProfit = async () => {
    setLoading(true)
    try {
        const currentYear = year ?? new Date().getFullYear()

        // ✅ Fetch current month revenue + expenses
        const { data: currentData, error: currentError } = await supabase
        .from('monthly_data')
        .select('final_revenue, expenses')
        .eq('user_id', userId)
        .eq('month', selectedMonth)
        .eq('year', currentYear)
        .maybeSingle()

        if (currentError) console.error('Error fetching current month data:', currentError)

        const currentProfit =
        currentData?.final_revenue != null && currentData?.expenses != null
            ? currentData.final_revenue - currentData.expenses
            : null

        setProfit(currentProfit)

        // ✅ Determine previous month/year
        const currentIndex = MONTHS.indexOf(selectedMonth)
        let prevIndex = currentIndex - 1
        let prevYear = currentYear
        if (prevIndex < 0) {
        prevIndex = 11
        prevYear -= 1
        }
        const prevMonth = MONTHS[prevIndex]

        // ✅ Fetch previous month revenue + expenses
        const { data: prevData, error: prevError } = await supabase
        .from('monthly_data')
        .select('final_revenue, expenses')
        .eq('user_id', userId)
        .eq('month', prevMonth)
        .eq('year', prevYear)
        .maybeSingle()

        if (prevError) console.error('Error fetching previous month data:', prevError)

        const prevProfit =
        prevData?.final_revenue != null && prevData?.expenses != null
            ? prevData.final_revenue - prevData.expenses
            : null

        setPrevProfit(prevProfit)
    } catch (err) {
        console.error('Error fetching profits:', err)
    } finally {
        setLoading(false)
    }
    }


    fetchProfit()
  }, [userId, selectedMonth, year])

  const formatCurrency = (amount: number) =>
    `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const calculateChange = (): number | null => {
    if (profit === null || prevProfit === null || prevProfit === 0) return null
    const diff = profit - prevProfit
    const percent = (diff / prevProfit) * 100
    return parseFloat(percent.toFixed(2))
  }

  const change = calculateChange()

  return (
    <div
      className="p-4 rounded-lg shadow-md relative flex flex-col min-h-[140px] border border-[color:var(--card-profit-border)]"
      style={{ background: 'var(--card-profit-bg)' }}
    >
      <h2 className="text-[#E8EDC7] text-base font-semibold mb-2">💰 Monthly Profit</h2>

      <div className="flex-1 flex items-center">
        <p className="text-3xl md:text-3xl sm:text-2xl font-bold text-[#F5E6C5]">
          {loading
            ? 'Loading...'
            : profit !== null
              ? formatCurrency(profit)
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
