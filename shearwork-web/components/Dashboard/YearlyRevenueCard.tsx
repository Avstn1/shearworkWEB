'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { useBarberLabel } from '@/hooks/useBarberLabel'

type Timeframe = 'year' | 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'YTD'

interface YearlyRevenueCardProps {
  userId: string
  year?: number
  timeframe?: Timeframe
}

const QUARTER_DATE_RANGES: Record<Exclude<Timeframe, 'year' | 'YTD'>, { startMonth: number; endMonth: number }> = {
  Q1: { startMonth: 1, endMonth: 3 },
  Q2: { startMonth: 4, endMonth: 6 },
  Q3: { startMonth: 7, endMonth: 9 },
  Q4: { startMonth: 10, endMonth: 12 },
}

export default function YearlyRevenueCard({
  userId,
  year,
  timeframe,
}: YearlyRevenueCardProps) {
  const [total, setTotal] = useState<number | null>(null)
  const [tips, setTips] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [barberType, setBarberType] = useState<'rental' | 'commission' | undefined>()
  const [commissionRate, setCommissionRate] = useState<number | null>(null)
  const { label } = useBarberLabel(barberType)

  useEffect(() => {
    if (!userId) return

    const fetchTotal = async () => {
      setLoading(true)
      try {
        const currentYear = year ?? new Date().getFullYear()

        // 1) Fetch profile (role, barber_type, commission_rate)
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('role, barber_type, commission_rate')
          .eq('user_id', userId)
          .maybeSingle()
        if (profileError) throw profileError

        if (profileData?.role?.toLowerCase() === 'barber') {
          setBarberType(profileData.barber_type ?? undefined)
          setCommissionRate(profileData.commission_rate ?? null)
        } else {
          setBarberType(undefined)
          setCommissionRate(null)
        }

        // 2) Determine date range based on timeframe
        let startDate: string
        let endDate: string

        if (timeframe === 'year' || timeframe === 'YTD') {
          startDate = `${currentYear}-01-01`
          endDate = `${currentYear + 1}-01-01`
        } else {
          const range = QUARTER_DATE_RANGES[timeframe!]
          startDate = `${currentYear}-${String(range.startMonth).padStart(2, '0')}-01`
          endDate = range.endMonth === 12 
            ? `${currentYear + 1}-01-01`
            : `${currentYear}-${String(range.endMonth + 1).padStart(2, '0')}-01`
        }

        // 3) Use RPC function for efficient aggregation
        const { data: aggregateData, error: rpcError } = await supabase
          .rpc('get_revenue_totals', {
            p_user_id: userId,
            p_start_date: startDate,
            p_end_date: endDate
          })
          .single()

        if (rpcError || !aggregateData) {
          throw rpcError || new Error('No data returned from RPC')
        }

        const totalRevenue = Number((aggregateData as any).total_revenue) || 0
        const totalTips = Number((aggregateData as any).total_tips) || 0
        
        let finalTotal = 0

        if (profileData?.role?.toLowerCase() === 'barber') {
          if (profileData.barber_type === 'commission') {
            const rate = profileData.commission_rate ?? 1
            finalTotal = totalRevenue * rate + totalTips
          } else {
            // Rental barber
            finalTotal = totalRevenue + totalTips
          }
        } else {
          // Non-barber user
          finalTotal = totalRevenue + totalTips
        }

        setTotal(finalTotal)
        setTips(totalTips)

      } catch (err) {
        console.error('Error fetching timeframe revenue:', err)
        setTotal(null)
        setTips(null)
      } finally {
        setLoading(false)
      }
    }

    fetchTotal()
  }, [userId, year, timeframe])

  const formatCurrency = (amount: number) =>
    `$${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`

  const titleSuffix =
    timeframe === 'year'
      ? 'YTD'
      : timeframe

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
        💰 Total {label} ({titleSuffix})
      </h2>

      <div className="flex-1 flex flex-col justify-center">
        <p className="text-3xl font-bold text-[#F5E6C5] truncate">
          {loading
            ? 'Loading...'
            : total !== null
            ? formatCurrency(total)
            : 'N/A'}
        </p>
        {!loading && tips !== null && tips > 0 && (
          <p className="text-sm text-amber-300 mt-1">
            (includes {formatCurrency(tips)} in tips)
          </p>
        )}
      </div>
    </div>
  )
}