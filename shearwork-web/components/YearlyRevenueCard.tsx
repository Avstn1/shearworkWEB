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
  const [barberType, setBarberType] = useState<'rental' | 'commission' | undefined>(undefined)

  const { label } = useBarberLabel(barberType)

  useEffect(() => {
    if (!userId) return

    const fetchTotal = async () => {
      setLoading(true)
      try {
        // Fetch barber type from profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('role, barber_type')
          .eq('user_id', userId)
          .maybeSingle()

        if (profileError) throw profileError
        if (profileData?.role?.toLowerCase() === 'barber') {
          setBarberType(profileData.barber_type ?? undefined)
        }

        const currentYear = year ?? new Date().getFullYear()

        const { data, error } = await supabase
          .from('reports')
          .select('total_revenue')
          .eq('user_id', userId)
          .eq('type', 'monthly')
          .eq('year', currentYear)

        if (error) throw error

        const totalSum = data?.reduce((sum, r) => sum + (r.total_revenue || 0), 0)
        setTotal(totalSum)
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
      className="p-4 rounded-lg shadow-md relative flex flex-col min-h-[140px] border border-[color:var(--card-revenue-border)]"
      style={{ background: 'var(--card-revenue-bg)' }}
    >
      <h2 className="text-[#E8EDC7] text-base font-semibold mb-2">💰 Total {label} (YTD)</h2>

      <div className="flex-1 flex items-center">
        <p className="text-3xl font-bold text-[#F5E6C5]">
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
