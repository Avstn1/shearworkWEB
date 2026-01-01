'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { useBarberLabel } from '@/hooks/useBarberLabel'

interface MonthlyProfitCardProps {
  userId: string
  selectedMonth?: string
  year?: number | null
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

export default function MonthlyProfitCard({ userId, selectedMonth, year }: MonthlyProfitCardProps) {
  const [profit, setProfit] = useState<number | null>(null)
  const [prevProfit, setPrevProfit] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [barberType, setBarberType] = useState<'rental' | 'commission' | undefined>()
  const { label } = useBarberLabel(barberType)

  // Helper to parse date strings as local dates (not UTC)
  const parseLocalDate = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  // Calculate expenses from recurring_expenses for a given month/year
  const calculateExpenses = async (month: string, year: number): Promise<number> => {
    const monthIndex = MONTHS.indexOf(month)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const isCurrentMonth = today.getMonth() === monthIndex && today.getFullYear() === year
    const endDay = isCurrentMonth ? today.getDate() : new Date(year, monthIndex + 1, 0).getDate()

    let totalExpense = 0

    const { data: recurringData } = await supabase
      .from('recurring_expenses')
      .select('*')
      .eq('user_id', userId)
    
    if (recurringData) {
      const monthStart = new Date(year, monthIndex, 1)
      const monthEnd = new Date(year, monthIndex + 1, 0)
      
      recurringData.forEach((rec: any) => {
        const start = parseLocalDate(rec.start_date)
        const end = rec.end_date ? parseLocalDate(rec.end_date) : null
                
        // Apply same filtering as ExpensesViewer
        let shouldInclude = false
        if (rec.frequency === 'once') {
          shouldInclude = start.getMonth() === monthIndex && start.getFullYear() === year
        } else {
          shouldInclude = start <= monthEnd && (!end || end >= monthStart)
        }
        
        if (!shouldInclude) return
        
        // Calculate occurrences up to endDay (only count if date has passed)
        switch (rec.frequency) {
          case 'once':
            const expDate = parseLocalDate(rec.start_date)
            if (expDate.getDate() <= endDay && expDate <= today) {
              totalExpense += rec.amount
            }
            break
          case 'weekly':
            const daysOfWeek = rec.weekly_days || []
            if (daysOfWeek.length === 0) break
            
            for (let d = 1; d <= endDay; d++) {
              const date = new Date(year, monthIndex, d)
              if (date >= start && (!end || date <= end) && date <= today) {
                const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getDay()]
                if (daysOfWeek.includes(dayName)) totalExpense += rec.amount
              }
            }
            break
          case 'monthly':
            if (rec.monthly_day && rec.monthly_day <= endDay && rec.monthly_day <= monthEnd.getDate()) {
              const occurrenceDate = new Date(year, monthIndex, rec.monthly_day)
              if (occurrenceDate >= start && (!end || occurrenceDate <= end) && occurrenceDate <= today) {
                totalExpense += rec.amount
              }
            }
            break
          case 'yearly':
            if (rec.yearly_month === monthIndex && rec.yearly_day && rec.yearly_day <= endDay && rec.yearly_day <= monthEnd.getDate()) {
              const occurrenceDate = new Date(year, monthIndex, rec.yearly_day)
              if (occurrenceDate >= start && (!end || occurrenceDate <= end) && occurrenceDate <= today) {
                totalExpense += rec.amount
              }
            }
            break
        }
      })
    }

    return totalExpense
  }

  useEffect(() => {
    if (!userId || !selectedMonth) return

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
      } catch (err) {
        console.error('Error fetching barber type:', err)
      }
    }

    fetchBarberType()
  }, [userId])

  useEffect(() => {
    if (!userId || !selectedMonth) return

    const fetchProfit = async () => {
      setLoading(true)
      try {
        const currentYear = year ?? new Date().getFullYear()

        // ✅ Fetch current month revenue
        const { data: currentData, error: currentError } = await supabase
          .from('monthly_data')
          .select('final_revenue')
          .eq('user_id', userId)
          .eq('month', selectedMonth)
          .eq('year', currentYear)
          .maybeSingle()

        if (currentError) console.error('Error fetching current month data:', currentError)

        // Calculate current expenses from recurring_expenses
        const currentExpenses = await calculateExpenses(selectedMonth, currentYear)

        const currentProfit =
          currentData?.final_revenue != null
            ? currentData.final_revenue - currentExpenses
            : null

        setProfit(currentProfit)

        // ✅ Determine previous month/year
        const currentIndex = MONTHS.indexOf(selectedMonth)
        let prevIndex = currentIndex - 1
        let prevYear = currentYear
        if (prevIndex < 0) {
          prevIndex = 11
          prevYear -= 1
        }
        const prevMonth = MONTHS[prevIndex]

        // ✅ Fetch previous month revenue
        const { data: prevData, error: prevError } = await supabase
          .from('monthly_data')
          .select('final_revenue')
          .eq('user_id', userId)
          .eq('month', prevMonth)
          .eq('year', prevYear)
          .maybeSingle()

        if (prevError) console.error('Error fetching previous month data:', prevError)

        // Calculate previous expenses from recurring_expenses
        const prevExpenses = await calculateExpenses(prevMonth, prevYear)

        const prevProfit =
          prevData?.final_revenue != null
            ? prevData.final_revenue - prevExpenses
            : null

        setPrevProfit(prevProfit)
      } catch (err) {
        console.error('Error fetching profits:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchProfit()
  }, [userId, selectedMonth, year])

  const formatCurrency = (amount: number) =>
    `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const calculateChange = (): number | null => {
    if (profit === null || prevProfit === null || prevProfit === 0) return null
    const diff = profit - prevProfit
    const percent = (diff / prevProfit) * 100
    return parseFloat(percent.toFixed(2))
  }

  const change = calculateChange()

  return (
    <div
      className="p-4 rounded-lg shadow-md relative flex flex-col min-h-[140px] border border-[color:var(--card-profit-border)]"
      style={{ background: 'var(--card-profit-bg)' }}
    >
      <h2 className="text-[#E8EDC7] text-base font-semibold mb-2">💰 Monthly Profit</h2>

      <div className="flex-1 flex items-center">
        <p className="text-3xl md:text-3xl sm:text-2xl font-bold text-[#F5E6C5]">
          {loading
            ? 'Loading...'
            : profit !== null
              ? formatCurrency(profit)
              : 'N/A'}
        </p>
      </div>

      <div className="flex justify-start mt-auto">
        {change !== null ? (
          <p
            className={`text-sm font-semibold ${
              change > 0
                ? 'text-green-400'
                : change < 0
                  ? 'text-red-400'
                  : 'text-gray-400'
            }`}
          >
            {change > 0 ? `+${change.toFixed(2)}%` : `${change.toFixed(2)}%`} <span className="text-gray-400">(vs. prior month)</span>
          </p>
        ) : (
          <p className="text-sm text-gray-500">—</p>
        )}
      </div>
    </div>
  )
}