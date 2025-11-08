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
  const { label } = useBarberLabel(barberType)

  const todayStr = selectedDate ?? new Date().toISOString().slice(0, 10)
  const yesterdayStr = (() => {
    const parts = todayStr.split('-').map(Number)
    const d = new Date(parts[0], parts[1] - 1, parts[2] - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  })()

  useEffect(() => {
    if (!userId) return
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
      } catch (err) { console.error('Error fetching barber type:', err) }
    }
    fetchBarberType()
  }, [userId])

  useEffect(() => {
    if (!userId) return
    const fetchRevenue = async () => {
      setLoading(true)
      try {
        const { data: todayData } = await supabase
          .from('daily_data')
          .select('final_revenue')
          .eq('user_id', userId)
          .eq('date', todayStr)
          .maybeSingle()
        setRevenue(todayData?.final_revenue ?? null)

        const { data: prevData } = await supabase
          .from('daily_data')
          .select('final_revenue')
          .eq('user_id', userId)
          .eq('date', yesterdayStr)
          .maybeSingle()
        setPrevRevenue(prevData?.final_revenue ?? null)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchRevenue()
  }, [userId, todayStr, yesterdayStr])

  const formatCurrency = (amount: number) =>
    `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const change = revenue !== null && prevRevenue !== null && prevRevenue !== 0
    ? parseFloat(((revenue - prevRevenue) / prevRevenue * 100).toFixed(2))
    : null

  return (
    <div className="w-full h-full flex flex-col p-4 rounded-lg shadow-md border border-[color:var(--card-revenue-border)]" style={{ background: 'var(--card-revenue-bg)' }}>
      <h2 className="text-[#E8EDC7] text-base font-semibold mb-2">💰 Daily {label}</h2>
      <div className="flex-1 flex items-center justify-start">
        <p className="text-3xl md:text-3xl sm:text-2xl font-bold text-[#F5E6C5]">
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
