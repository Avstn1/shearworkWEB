'use client'

import { CalendarDays } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { useBarberLabel } from '@/hooks/useBarberLabel'
import { Stat } from '@/components/ui/AppKit'

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
        const { data: todayRow, error: todayError } = await supabase
          .from('daily_data')
          .select('total_revenue, tips, num_appointments')
          .eq('user_id', userId)
          .eq('date', todayStr)
          .maybeSingle()

        if (todayError) throw todayError

        if (todayRow) {
          const totalRevenue = Number(todayRow.total_revenue || 0)
          const totalTips = Number(todayRow.tips || 0)

          const finalRevenue = barberType === 'commission' && commissionRate !== null
            ? totalRevenue * commissionRate + totalTips
            : totalRevenue + totalTips

          setRevenue(finalRevenue)
          setTips(totalTips)
        } else {
          setRevenue(null)
          setTips(null)
        }

        const { data: prevRows, error: prevError } = await supabase
          .from('daily_data')
          .select('date, total_revenue, tips, num_appointments')
          .eq('user_id', userId)
          .lt('date', todayStr)
          .or('total_revenue.gt.0,tips.gt.0,num_appointments.gt.0')
          .order('date', { ascending: false })
          .limit(1)

        if (prevError) throw prevError

        const prevRow = prevRows?.[0]

        if (prevRow) {
          const prevTotalRevenue = Number(prevRow.total_revenue || 0)
          const prevTotalTips = Number(prevRow.tips || 0)

          const prevFinal = barberType === 'commission' && commissionRate !== null
            ? prevTotalRevenue * commissionRate + prevTotalTips
            : prevTotalRevenue + prevTotalTips

          setPrevRevenue(prevFinal)
          setPrevDataDate(prevRow.date)
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
    <div className="flex h-full w-full flex-col">
      <Stat icon={CalendarDays} tone="sage"
        label={`Daily ${label}`}
        value={
          loading ? (
            <span className="text-base font-medium text-gray-500">Loading…</span>
          ) : revenue !== null ? (
            formatCurrency(revenue)
          ) : (
            <span className="text-base font-medium text-gray-500">No revenue this day</span>
          )
        }
        delta={change}
        hint={change !== null ? <span>vs. last record ({prevDataDate})</span> : <span>No prior record</span>}
      />
      {!loading && tips !== null && tips > 0 && (
        <p className="mt-1 text-xs tabular-nums text-gray-500">Includes {formatCurrency(tips)} in tips</p>
      )}
    </div>
  )
}
