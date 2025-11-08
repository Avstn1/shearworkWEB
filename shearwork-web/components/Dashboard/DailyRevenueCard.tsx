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
  const [prevRevenue, setPrevRevenue] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [barberType, setBarberType] = useState<'rental' | 'commission' | undefined>()
  const [commissionRate, setCommissionRate] = useState<number | null>(null)
  const { label } = useBarberLabel(barberType)

  const todayStr = selectedDate ?? new Date().toISOString().slice(0, 10)
  const yesterdayStr = (() => {
    const d = new Date(todayStr)
    d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  })()

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
        // Today
        const { data: todayData } = await supabase
          .from('daily_data')
          .select('total_revenue, tips')
          .eq('user_id', userId)
          .eq('date', todayStr)
          .maybeSingle()

        if (todayData) {
          const total = todayData.total_revenue ?? 0
          const tips = todayData.tips ?? 0
          const final =
            barberType === 'commission' && commissionRate !== null
              ? total * commissionRate + tips
              : total
          setRevenue(final)
        }

        // Yesterday
        const { data: prevData } = await supabase
          .from('daily_data')
          .select('total_revenue, tips')
          .eq('user_id', userId)
          .eq('date', yesterdayStr)
          .maybeSingle()

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
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchRevenue()
  }, [userId, todayStr, yesterdayStr, barberType, commissionRate])

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
      <div className="flex-1 flex items-center">
        <p className="text-3xl font-bold text-[#F5E6C5]">
          {loading ? 'Loading...' : revenue !== null ? formatCurrency(revenue) : 'No revenue this day!'}
        </p>
      </div>
      <div className="mt-auto">
        {change !== null ? (
          <p className={`text-sm font-semibold ${change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-gray-400'}`}>
            {change > 0 ? `+${change}%` : `${change}%`} <span className="text-gray-400">(vs. yesterday)</span>
          </p>
        ) : <p className="text-sm text-gray-500">—</p>}
      </div>
    </div>
  )
}
