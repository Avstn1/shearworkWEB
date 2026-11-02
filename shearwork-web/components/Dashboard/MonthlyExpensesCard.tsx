'use client'

import { Receipt } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Stat } from '@/components/ui/AppKit'

interface MonthlyExpensesCardProps {
  userId?: string
  month: string
  year: number
}

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function MonthlyExpensesCard({ userId, month, year }: MonthlyExpensesCardProps) {
  const [expenses, setExpenses] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)

  // Helper to parse date strings as local dates (not UTC)
  const parseLocalDate = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  const fetchExpenses = async () => {
    try {
      setLoading(true)
      
      const monthIndex = MONTHS.indexOf(month)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const isCurrentMonth = today.getMonth() === monthIndex && today.getFullYear() === year
      const endDay = isCurrentMonth ? today.getDate() : new Date(year, monthIndex + 1, 0).getDate()

      let totalExpense = 0

      // Add recurring expenses that have occurred up to endDay
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

      setExpenses(totalExpense)
    } catch (err) {
      console.error('Failed to fetch monthly expenses:', err)
      toast.error('Failed to load expenses')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (userId && month && year) {
      fetchExpenses()
    }
  }, [userId, month, year])

  const formatCurrency = (amount: number) =>
    `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="flex h-full w-full flex-col"
    >
      <Stat icon={Receipt} tone="coral"
        label="Monthly Expenses"
        value={loading ? <span className="text-base font-medium text-gray-500">Loading…</span> : formatCurrency(expenses)}
      />
    </motion.div>
  )
}