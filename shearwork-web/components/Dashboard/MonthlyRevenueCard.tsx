'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { useBarberLabel } from '@/hooks/useBarberLabel'

interface MonthlyRevenueCardProps {
  userId: string
  selectedMonth?: string
  year?: number | null
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
  const [commissionRate, setCommissionRate] = useState<number | null>(null)
  const { label } = useBarberLabel(barberType)

  useEffect(() => {
    if (!userId || !selectedMonth) return

    const fetchProfile = async () => {
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role, barber_type, commission_rate')
          .eq('user_id', userId)
          .maybeSingle()

        if (error) throw error

        if (profile?.role?.toLowerCase() === 'barber') {
          setBarberType(profile.barber_type ?? undefined)
          setCommissionRate(profile.commission_rate ?? null)
        }
      } catch (err) {
        console.error('Error fetching profile:', err)
      }
    }

    fetchProfile()
  }, [userId])

  useEffect(() => {
    if (!userId || !selectedMonth) return

    const fetchRevenue = async () => {
      setLoading(true)
      try {
        const currentYear = year ?? new Date().getFullYear()

        // Fetch current month totals
        const { data: currentData, error: currentError } = await supabase
          .from('monthly_data')
          .select('total_revenue, tips')
          .eq('user_id', userId)
          .eq('month', selectedMonth)
          .eq('year', currentYear)
          .maybeSingle()
        if (currentError) console.error(currentError)

        let finalRevenue = null
        if (currentData) {
          const total = currentData.total_revenue ?? 0
          const tips = currentData.tips ?? 0
          finalRevenue =
            barberType === 'commission' && commissionRate !== null
              ? total * commissionRate + tips
              : total
        }
        setRevenue(finalRevenue)

        // Fetch previous month totals
        const currentIndex = MONTHS.indexOf(selectedMonth)
        let prevIndex = currentIndex - 1
        let prevYear = currentYear
        if (prevIndex < 0) {
          prevIndex = 11
          prevYear -= 1
        }
        const prevMonth = MONTHS[prevIndex]

        const { data: prevData, error: prevError } = await supabase
          .from('monthly_data')
          .select('total_revenue, tips')
          .eq('user_id', userId)
          .eq('month', prevMonth)
          .eq('year', prevYear)
          .maybeSingle()
        if (prevError) console.error(prevError)

        if (prevData) {
          const total = prevData.total_revenue ?? 0
          const tips = prevData.tips ?? 0
          const prevFinal =
            barberType === 'commission' && commissionRate !== null
              ? total * commissionRate + tips
              : total
          setPrevRevenue(prevFinal)
        }
      } catch (err) {
        console.error('Error fetching revenues:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchRevenue()
  }, [userId, selectedMonth, year, barberType, commissionRate])

  const formatCurrency = (amount: number) =>
    `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const calculateChange = (): number | null => {
    if (revenue === null || prevRevenue === null || prevRevenue === 0) return null
    return parseFloat((((revenue - prevRevenue) / prevRevenue) * 100).toFixed(2))
  }

  const change = calculateChange()

  return (
    <div className="p-4 rounded-lg shadow-md relative flex flex-col flex-1 border border-[color:var(--card-revenue-border)]"
      style={{ background: 'var(--card-revenue-bg)' }}>
      <h2 className="text-[#E8EDC7] text-base font-semibold mb-2">🏆 Monthly {label}</h2>
      <div className="flex-1 flex items-center">
        <p className="text-3xl font-bold text-[#F5E6C5]">
          {loading ? 'Loading...' : revenue !== null ? formatCurrency(revenue) : 'N/A'}
        </p>
      </div>
      <div className="mt-auto">
        {change !== null ? (
          <p className={`text-sm font-semibold ${change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-gray-400'}`}>
            {change > 0 ? `+${change}%` : `${change}%`} <span className="text-gray-400">(vs. prior month)</span>
          </p>
        ) : <p className="text-sm text-gray-500">—</p>}
      </div>
    </div>
  )
}
