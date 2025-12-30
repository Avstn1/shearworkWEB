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
        
        // Build date range for the month
        const startDate = `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}-01`
        const endDate = monthIndex === 11 
          ? `${currentYear + 1}-01-01`
          : `${currentYear}-${String(monthIndex + 2).padStart(2, '0')}-01`

        // Fetch current month totals from acuity_appointments
        const { data: currentAppts, error: currentError } = await supabase
          .from('acuity_appointments')
          .select('revenue, tip')
          .eq('user_id', userId)
          .gte('appointment_date', startDate)
          .lt('appointment_date', endDate)

        if (currentError) throw currentError

        let finalRevenue = null
        let totalTips = null

        if (currentAppts && currentAppts.length > 0) {
          const totalRevenue = currentAppts.reduce((sum, appt) => sum + (appt.revenue || 0), 0)
          totalTips = currentAppts.reduce((sum, appt) => sum + (appt.tip || 0), 0)
          
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

        const prevStartDate = `${prevYear}-${String(prevMonthIndex + 1).padStart(2, '0')}-01`
        const prevEndDate = prevMonthIndex === 11 
          ? `${prevYear + 1}-01-01`
          : `${prevYear}-${String(prevMonthIndex + 2).padStart(2, '0')}-01`

        const { data: prevAppts, error: prevError } = await supabase
          .from('acuity_appointments')
          .select('revenue, tip')
          .eq('user_id', userId)
          .gte('appointment_date', prevStartDate)
          .lt('appointment_date', prevEndDate)

        if (prevError) throw prevError

        if (prevAppts && prevAppts.length > 0) {
          const prevTotalRevenue = prevAppts.reduce((sum, appt) => sum + (appt.revenue || 0), 0)
          const prevTotalTips = prevAppts.reduce((sum, appt) => sum + (appt.tip || 0), 0)
          
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
    <div className="p-4 rounded-lg shadow-md relative flex flex-col flex-1 border border-[color:var(--card-revenue-border)]"
      style={{ background: 'var(--card-revenue-bg)' }}>
      <h2 className="text-[#E8EDC7] text-base font-semibold mb-2">🏆 Monthly {label}</h2>
      <div className="flex-1 flex flex-col justify-center">
        <p className="text-3xl font-bold text-[#F5E6C5]">
          {loading ? 'Loading...' : revenue !== null ? formatCurrency(revenue) : 'N/A'}
        </p>
        {!loading && tips !== null && tips > 0 && (
          <p className="text-sm text-amber-300 mt-1">
            (includes {formatCurrency(tips)} in tips)
          </p>
        )}
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