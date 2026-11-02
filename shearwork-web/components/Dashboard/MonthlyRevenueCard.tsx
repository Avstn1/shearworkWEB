'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { useBarberLabel } from '@/hooks/useBarberLabel'
import { Stat } from '@/components/ui/AppKit'

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
  const [tips, setTips] = useState<number | null>(null)
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
        const monthIndex = MONTHS.indexOf(selectedMonth)

        const { data: currentMonthRow, error: currentError } = await supabase
          .from('monthly_data')
          .select('total_revenue, tips')
          .eq('user_id', userId)
          .eq('month', selectedMonth)
          .eq('year', currentYear)
          .maybeSingle()

        if (currentError) throw currentError

        let finalRevenue = null
        let totalTips = null

        if (currentMonthRow) {
          const totalRevenue = Number(currentMonthRow.total_revenue || 0)
          totalTips = Number(currentMonthRow.tips || 0)

          finalRevenue = barberType === 'commission' && commissionRate !== null
            ? totalRevenue * commissionRate + totalTips
            : totalRevenue + totalTips
        }

        setRevenue(finalRevenue)
        setTips(totalTips)

        // Fetch previous month totals
        let prevMonthIndex = monthIndex - 1
        let prevYear = currentYear
        if (prevMonthIndex < 0) {
          prevMonthIndex = 11
          prevYear -= 1
        }

        const prevMonthName = MONTHS[prevMonthIndex]

        const { data: prevMonthRow, error: prevError } = await supabase
          .from('monthly_data')
          .select('total_revenue, tips')
          .eq('user_id', userId)
          .eq('month', prevMonthName)
          .eq('year', prevYear)
          .maybeSingle()

        if (prevError) throw prevError

        if (prevMonthRow) {
          const prevTotalRevenue = Number(prevMonthRow.total_revenue || 0)
          const prevTotalTips = Number(prevMonthRow.tips || 0)

          const prevFinal = barberType === 'commission' && commissionRate !== null
            ? prevTotalRevenue * commissionRate + prevTotalTips
            : prevTotalRevenue + prevTotalTips

          setPrevRevenue(prevFinal)
        } else {
          setPrevRevenue(null)
        }

      } catch (err) {
        console.error('Error fetching monthly revenue:', err)
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
    <div className="flex h-full w-full flex-col">
      <Stat
        label={`Monthly ${label}`}
        value={
          loading ? (
            <span className="text-base font-medium text-gray-500">Loading…</span>
          ) : revenue !== null ? (
            formatCurrency(revenue)
          ) : (
            'N/A'
          )
        }
        delta={change}
        hint={<span>{change !== null ? 'vs. prior month' : 'No prior month data'}</span>}
      />
      {!loading && tips !== null && tips > 0 && (
        <p className="mt-1 text-xs tabular-nums text-gray-500">Includes {formatCurrency(tips)} in tips</p>
      )}
    </div>
  )
}
