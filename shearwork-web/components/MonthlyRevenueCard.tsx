'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { useBarberLabel } from '@/hooks/useBarberLabel'

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

    const fetchRevenue = async () => {
      setLoading(true)
      try {
        const currentYear = year ?? new Date().getFullYear()

        // Current month revenue
        const { data: currentData } = await supabase
          .from('reports')
          .select('total_revenue')
          .eq('user_id', userId)
          .eq('type', 'monthly')
          .eq('month', selectedMonth)
          .eq('year', currentYear)
          .maybeSingle()

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

        const { data: prevData } = await supabase
          .from('reports')
          .select('total_revenue')
          .eq('user_id', userId)
          .eq('type', 'monthly')
          .eq('month', prevMonth)
          .eq('year', prevYear)
          .maybeSingle()

        setPrevRevenue(prevData?.total_revenue ?? null)
      } catch (err) {
        console.error('Error fetching revenues:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchRevenue()
  }, [userId, selectedMonth, year])

  const formatCurrency = (amount: number) =>
    `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const calculateChange = () => {
    if (revenue === null || prevRevenue === null || prevRevenue === 0) return null
    const diff = revenue - prevRevenue
    const percent = (diff / prevRevenue) * 100
    return Math.round(percent)
  }

  const change = calculateChange()

  return (
    <div
      className="p-4 rounded-lg shadow-md relative flex flex-col min-h-[140px] border border-[color:var(--card-revenue-border)]"
      style={{ background: 'var(--card-revenue-bg)' }}
    >
      <h2 className="text-[#E8EDC7] text-base font-semibold mb-2">🏆 Monthly {label}</h2>

      <div className="flex-1 flex items-center">
        <p className="text-3xl font-bold text-[#F5E6C5]">
          {loading
            ? 'Loading...'
            : revenue !== null
              ? formatCurrency(revenue)
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
            {change > 0 ? `+${change}%` : `${change}%`}
          </p>
        ) : (
          <p className="text-sm text-gray-500">—</p>
        )}
      </div>
    </div>
  )
}
