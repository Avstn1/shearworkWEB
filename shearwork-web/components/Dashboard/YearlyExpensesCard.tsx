'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'

type Timeframe = 'year' | 'Q1' | 'Q2' | 'Q3' | 'Q4'

interface Props {
  userId: string
  year: number
  timeframe: Timeframe
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function getMonthsForTimeframe(timeframe: Timeframe): string[] {
  switch (timeframe) {
    case 'Q1':
      return ['January', 'February', 'March']
    case 'Q2':
      return ['April', 'May', 'June']
    case 'Q3':
      return ['July', 'August', 'September']
    case 'Q4':
      return ['October', 'November', 'December']
    case 'year':
    default:
      return MONTHS
  }
}

export default function YearlyExpensesCard({ userId, year, timeframe }: Props) {
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  // Helper to parse date strings as local dates (not UTC)
  const parseLocalDate = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  useEffect(() => {
    if (!userId) return

    const fetchData = async () => {
      setLoading(true)
      try {
        const monthsToInclude = getMonthsForTimeframe(timeframe)
        let grandTotal = 0

        // Fetch all recurring expenses once
        const { data: recurringData, error: recurringError } = await supabase
          .from('recurring_expenses')
          .select('*')
          .eq('user_id', userId)

        if (recurringError) throw recurringError

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // Calculate expenses for each month in the timeframe
        for (const month of monthsToInclude) {
          const monthIndex = MONTHS.indexOf(month)
          const isCurrentMonth = today.getMonth() === monthIndex && today.getFullYear() === year
          const endDay = isCurrentMonth ? today.getDate() : new Date(year, monthIndex + 1, 0).getDate()

          let monthExpense = 0

          if (recurringData) {
            const monthStart = new Date(year, monthIndex, 1)
            const monthEnd = new Date(year, monthIndex + 1, 0)
            
            recurringData.forEach((rec: any) => {
              const start = parseLocalDate(rec.start_date)
              const end = rec.end_date ? parseLocalDate(rec.end_date) : null
                      
              // Apply same filtering
              let shouldInclude = false
              if (rec.frequency === 'once') {
                shouldInclude = start.getMonth() === monthIndex && start.getFullYear() === year
              } else {
                shouldInclude = start <= monthEnd && (!end || end >= monthStart)
              }
              
              if (!shouldInclude) return
              
              // Calculate occurrences up to endDay
              switch (rec.frequency) {
                case 'once':
                  const expDate = parseLocalDate(rec.start_date)
                  if (expDate.getDate() <= endDay && expDate <= today) {
                    monthExpense += rec.amount
                  }
                  break
                case 'weekly':
                  const daysOfWeek = rec.weekly_days || []
                  if (daysOfWeek.length === 0) break
                  
                  for (let d = 1; d <= endDay; d++) {
                    const date = new Date(year, monthIndex, d)
                    if (date >= start && (!end || date <= end) && date <= today) {
                      const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getDay()]
                      if (daysOfWeek.includes(dayName)) monthExpense += rec.amount
                    }
                  }
                  break
                case 'monthly':
                  if (rec.monthly_day && rec.monthly_day <= endDay && rec.monthly_day <= monthEnd.getDate()) {
                    const occurrenceDate = new Date(year, monthIndex, rec.monthly_day)
                    if (occurrenceDate >= start && (!end || occurrenceDate <= end) && occurrenceDate <= today) {
                      monthExpense += rec.amount
                    }
                  }
                  break
                case 'yearly':
                  if (rec.yearly_month === monthIndex && rec.yearly_day && rec.yearly_day <= endDay && rec.yearly_day <= monthEnd.getDate()) {
                    const occurrenceDate = new Date(year, monthIndex, rec.yearly_day)
                    if (occurrenceDate >= start && (!end || occurrenceDate <= end) && occurrenceDate <= today) {
                      monthExpense += rec.amount
                    }
                  }
                  break
              }
            })
          }

          grandTotal += monthExpense
        }

        setTotal(grandTotal)
      } catch (err) {
        console.error('Error fetching timeframe expenses:', err)
        setTotal(null)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [userId, year, timeframe])

  const formatCurrency = (n: number) =>
    `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const titleSuffix = timeframe === 'year' ? 'YTD' : timeframe

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
        💸 Total Expenses ({titleSuffix})
      </h2>
      <div className="flex-1 flex items-center justify-start">
        <p className="text-3xl font-bold text-[#F5E6C5] truncate">
          {loading ? 'Loading...' : total !== null ? formatCurrency(total) : 'N/A'}
        </p>
      </div>
    </div>
  )
}