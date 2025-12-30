'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { useBarberLabel } from '@/hooks/useBarberLabel'

interface DailyRevenueCardProps {
  userId: string
  selectedDate?: string // YYYY-MM-DD
}

export default function DailyRevenueCard({ userId, selectedDate }: DailyRevenueCardProps) {
  const [revenue, setRevenue] = useState<number | null>(null)
  const [tips, setTips] = useState<number | null>(null)
  const [prevRevenue, setPrevRevenue] = useState<number | null>(null)
  const [prevDataDate, setPrevDataDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [barberType, setBarberType] = useState<'rental' | 'commission' | undefined>()
  const [commissionRate, setCommissionRate] = useState<number | null>(null)
  const { label } = useBarberLabel(barberType)

  const todayStr = selectedDate ?? new Date().toISOString().slice(0, 10)

  useEffect(() => {
    if (!userId) return

    const fetchProfile = async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, barber_type, commission_rate')
          .eq('user_id', userId)
          .maybeSingle()

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
    if (!userId) return

    const fetchRevenue = async () => {
      setLoading(true)
      try {
        // Fetch today's data from acuity_appointments (source of truth for per-appointment tips)
        const { data: todayAppts, error: todayError } = await supabase
          .from('acuity_appointments')
          .select('revenue, tip')
          .eq('user_id', userId)
          .eq('appointment_date', todayStr)

        if (todayError) throw todayError

        if (todayAppts && todayAppts.length > 0) {
          const totalRevenue = todayAppts.reduce((sum, appt) => sum + (appt.revenue || 0), 0)
          const totalTips = todayAppts.reduce((sum, appt) => sum + (appt.tip || 0), 0)
          
          // Apply commission rate if applicable
          const finalRevenue = barberType === 'commission' && commissionRate !== null
            ? totalRevenue * commissionRate + totalTips
            : totalRevenue + totalTips
          
          setRevenue(finalRevenue)
          setTips(totalTips)
        } else {
          setRevenue(null)
          setTips(null)
        }

        // Fetch previous day's data for comparison
        const { data: prevAppts, error: prevError } = await supabase
          .from('acuity_appointments')
          .select('revenue, tip, appointment_date')
          .eq('user_id', userId)
          .lt('appointment_date', todayStr)
          .order('appointment_date', { ascending: false })
          .limit(50) // Get enough to find a day with appointments

        if (prevError) throw prevError

        if (prevAppts && prevAppts.length > 0) {
          // Group by date and find the most recent date with appointments
          const dateGroups: Record<string, { revenue: number; tips: number }> = {}
          
          for (const appt of prevAppts) {
            const date = appt.appointment_date
            if (!dateGroups[date]) {
              dateGroups[date] = { revenue: 0, tips: 0 }
            }
            dateGroups[date].revenue += appt.revenue || 0
            dateGroups[date].tips += appt.tip || 0
          }

          // Get the most recent date
          const sortedDates = Object.keys(dateGroups).sort().reverse()
          if (sortedDates.length > 0) {
            const prevDate = sortedDates[0]
            const prevData = dateGroups[prevDate]
            
            const prevFinal = barberType === 'commission' && commissionRate !== null
              ? prevData.revenue * commissionRate + prevData.tips
              : prevData.revenue + prevData.tips
            
            setPrevRevenue(prevFinal)
            setPrevDataDate(prevDate)
          } else {
            setPrevRevenue(null)
            setPrevDataDate(null)
          }
        } else {
          setPrevRevenue(null)
          setPrevDataDate(null)
        }

      } catch (err) {
        console.error('Error fetching daily revenue:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchRevenue()
  }, [userId, todayStr, barberType, commissionRate])

  const formatCurrency = (amount: number) =>
    `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const change =
    revenue !== null && prevRevenue !== null && prevRevenue !== 0
      ? parseFloat(((revenue - prevRevenue) / prevRevenue * 100).toFixed(2))
      : null

  return (
    <div className="w-full h-full flex flex-col p-4 rounded-lg shadow-md border border-[color:var(--card-revenue-border)]"
      style={{ background: 'var(--card-revenue-bg)' }}>
      <h2 className="text-[#E8EDC7] text-base font-semibold mb-2">💰 Daily {label}</h2>
      <div className="flex-1 flex flex-col justify-center">
        <p className="text-3xl font-bold text-[#F5E6C5]">
          {loading ? 'Loading...' : revenue !== null ? formatCurrency(revenue) : 'No revenue this day!'}
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
            {change > 0 ? `+${change}%` : `${change}%`} <span className="text-gray-400">(vs. last record: {prevDataDate})</span>
          </p>
        ) : <p className="text-sm text-gray-500">—</p>}
      </div>
    </div>
  )
}