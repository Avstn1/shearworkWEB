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

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

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

        const now = new Date()
        const isCurrentYear = currentYear === now.getFullYear()

        let startMonth = 1
        let endMonth = 12

        if (timeframe === 'year' || timeframe === 'YTD') {
          endMonth = isCurrentYear ? now.getMonth() + 1 : 12
        } else {
          const range = QUARTER_DATE_RANGES[timeframe!]
          startMonth = range.startMonth
          endMonth = range.endMonth
        }

        const monthRange = MONTHS.slice(startMonth - 1, endMonth)

        const { data: rows, error: summaryError } = await supabase
          .from('monthly_data')
          .select('total_revenue, tips, month')
          .eq('user_id', userId)
          .eq('year', currentYear)
          .in('month', monthRange)

        if (summaryError) {
          throw summaryError
        }

        if (!rows || rows.length === 0) {
          setTotal(null)
          setTips(null)
          return
        }

        const totalRevenue = rows.reduce(
          (sum, row) => sum + Number(row.total_revenue || 0),
          0
        )
        const totalTips = rows.reduce(
          (sum, row) => sum + Number(row.tips || 0),
          0
        )
        
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