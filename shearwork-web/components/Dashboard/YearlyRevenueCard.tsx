'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { useBarberLabel } from '@/hooks/useBarberLabel'

type Timeframe = 'year' | 'Q1' | 'Q2' | 'Q3' | 'Q4'

interface YearlyRevenueCardProps {
  userId: string
  year?: number
  timeframe: Timeframe
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const QUARTER_MONTHS: Record<Exclude<Timeframe, 'year'>, string[]> = {
  Q1: ['January', 'February', 'March'],
  Q2: ['April', 'May', 'June'],
  Q3: ['July', 'August', 'September'],
  Q4: ['October', 'November', 'December'],
}

export default function YearlyRevenueCard({
  userId,
  year,
  timeframe,
}: YearlyRevenueCardProps) {
  const [total, setTotal] = useState<number | null>(null)
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

        let finalTotal = 0

        // 2) YEAR view – keep using yearly_revenue
        if (timeframe === 'year') {
          const { data: yearlyData, error: yearlyError } = await supabase
            .from('yearly_revenue')
            .select('total_revenue, tips, final_revenue')
            .eq('user_id', userId)
            .eq('year', currentYear)
            .maybeSingle()
          if (yearlyError) throw yearlyError

          if (profileData?.role?.toLowerCase() === 'barber') {
            if (profileData.barber_type === 'commission') {
              const totalRevenue = yearlyData?.total_revenue ?? 0
              const tips = yearlyData?.tips ?? 0
              const rate = profileData.commission_rate ?? 1
              finalTotal = totalRevenue * rate + tips
            } else {
              finalTotal = yearlyData?.final_revenue ?? 0
            }
          } else {
            finalTotal = yearlyData?.final_revenue ?? 0
          }
        } else {
          // 3) QUARTER view – sum from monthly_data for that quarter
          const months = QUARTER_MONTHS[timeframe]

          const { data: monthlyRows, error: monthlyError } = await supabase
            .from('monthly_data')
            .select('month, total_revenue, final_revenue, tips')
            .eq('user_id', userId)
            .eq('year', currentYear)
            .in('month', months)

          if (monthlyError) throw monthlyError

          if (profileData?.role?.toLowerCase() === 'barber') {
            if (profileData.barber_type === 'commission') {
              const rate = profileData.commission_rate ?? 1
              ;(monthlyRows ?? []).forEach((row: any) => {
                // follow same pattern as your monthly card:
                const base =
                  row.total_revenue ??
                  row.final_revenue ??
                  0
                const tips = row.tips ?? 0
                finalTotal += base * rate + tips
              })
            } else {
              // rental: use final_revenue
              ;(monthlyRows ?? []).forEach((row: any) => {
                finalTotal += Number(row.final_revenue) || 0
              })
            }
          } else {
            // non-barber user: just use final_revenue
            ;(monthlyRows ?? []).forEach((row: any) => {
              finalTotal += Number(row.final_revenue) || 0
            })
          }
        }

        setTotal(finalTotal)
      } catch (err) {
        console.error('Error fetching timeframe revenue:', err)
        setTotal(null)
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
