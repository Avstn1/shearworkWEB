'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { useBarberLabel } from '@/hooks/useBarberLabel'

interface YearlyRevenueCardProps {
  userId: string
  year?: number
}

export default function YearlyRevenueCard({ userId, year }: YearlyRevenueCardProps) {
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [barberType, setBarberType] = useState<'rental' | 'commission' | undefined>()
  const { label } = useBarberLabel(barberType)

  useEffect(() => {
    if (!userId) return

    const fetchTotal = async () => {
      setLoading(true)
      try {
        const currentYear = year ?? new Date().getFullYear()

        // Fetch profile info including commission_rate
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('role, barber_type, commission_rate')
          .eq('user_id', userId)
          .maybeSingle()
        if (profileError) throw profileError

        let finalTotal = 0

        // Fetch yearly revenue
        const { data: yearlyData, error: yearlyError } = await supabase
          .from('yearly_revenue')
          .select('total_revenue, tips, final_revenue')
          .eq('user_id', userId)
          .eq('year', currentYear)
          .maybeSingle()
        if (yearlyError) throw yearlyError

        if (profileData?.role?.toLowerCase() === 'barber') {
          setBarberType(profileData.barber_type ?? undefined)

          if (profileData.barber_type === 'commission') {
            // Commission barber: calculate final earnings
            const totalRevenue = yearlyData?.total_revenue ?? 0
            const tips = yearlyData?.tips ?? 0
            const commissionRate = profileData.commission_rate ?? 1
            finalTotal = totalRevenue * commissionRate + tips
          } else {
            // Rental or other types: just use final_revenue
            finalTotal = yearlyData?.final_revenue ?? 0
          }
        } else {
          finalTotal = yearlyData?.final_revenue ?? 0
        }

        setTotal(finalTotal)
      } catch (err) {
        console.error('Error fetching yearly revenue:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchTotal()
  }, [userId, year])

  const formatCurrency = (amount: number) =>
    `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div
      className="flex flex-col justify-between rounded-lg shadow-md border border-[color:var(--card-revenue-border)]"
      style={{
        background: 'var(--card-revenue-bg)',
        height: '100%',
        minHeight: '150px',
        maxHeight: '200px',
        padding: '1rem',
      }}
    >
      <h2 className="text-[#E8EDC7] text-base font-semibold mb-2">
        💰 Total {label} (YTD)
      </h2>

      <div className="flex-1 flex items-center justify-start">
        <p className="text-3xl font-bold text-[#F5E6C5] truncate">
          {loading
            ? 'Loading...'
            : total !== null
              ? formatCurrency(total)
              : 'N/A'}
        </p>
      </div>
    </div>
  )
}
