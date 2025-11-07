'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

interface MonthlyExpensesCardProps {
  userId: string
  month: string
  year: number
}

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

export default function MonthlyExpensesCard({ userId, month, year }: MonthlyExpensesCardProps) {
  const [expenses, setExpenses] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)

  const fetchExpenses = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('monthly_data')
        .select('expenses')
        .eq('user_id', userId)
        .eq('month', month)
        .eq('year', year)
        .maybeSingle()

      if (error) throw error
      setExpenses(data?.expenses || 0)
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
      className="w-full h-full flex flex-col justify-between rounded-lg shadow-md border border-[color:var(--card-expenses-border)]"
      style={{
        background: 'var(--card-expenses-bg)',
        padding: '1rem',
        minHeight: '150px',
        maxHeight: '200px',
      }}
    >
      <h2 className="text-[#F5C7C7] text-base font-semibold mb-2">
        🧾 Monthly Expenses
      </h2>

      <div className="flex-1 flex items-center justify-start">
        <p className="text-2xl sm:text-3xl font-bold text-[#F5C7C7] truncate">
          {loading ? 'Loading...' : formatCurrency(expenses)}
        </p>
      </div>
    </motion.div>
  )
}
