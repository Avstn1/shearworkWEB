'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import MonthlyRevenueCard from '@/components/Dashboard/MonthlyRevenueCard'
import MonthlyExpensesCard from '@/components/Dashboard/MonthlyExpensesCard'
import MonthlyProfitCard from '@/components/Dashboard/MonthlyProfitCard'
import ProfitLossTrendChart from '@/components/Dashboard/ProfitLossTrendChart'
import ProfitMarginPieChart from '@/components/Dashboard/ProfitMarginPieChart'
import DailyRevenueCard from '@/components/Dashboard/DailyRevenueCard'

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number = 1) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
}

export default function ProfitLossDashboard({
  userId,
  selectedMonth,
  selectedYear,
  globalRefreshKey, // 👈 new prop (passed from DashboardPage)
}: {
  userId: string
  selectedMonth: string
  selectedYear: number
  globalRefreshKey?: number
}) {
  const [refreshKey, setRefreshKey] = useState(0)

  // Whenever parent triggers sync or month/year changes → refresh children
  useEffect(() => {
    setRefreshKey((prev) => prev + 1)
  }, [selectedMonth, selectedYear, globalRefreshKey])

  const cardClass =
    'bg-white/10 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl p-4 flex flex-col flex-1'

  return (
    <motion.div
      className="grid grid-cols-1 lg:grid-cols-2 gap-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div variants={fadeInUp} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <motion.div className={cardClass}>
          <DailyRevenueCard
            key={`revenue-${refreshKey}`}
            userId={userId}
          />
        </motion.div>
        <motion.div className={cardClass}>
          <MonthlyRevenueCard
            key={`revenue-${refreshKey}`}
            userId={userId}
            selectedMonth={selectedMonth}
            year={selectedYear}
          />
        </motion.div>
      </motion.div>

      <motion.div variants={fadeInUp} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <motion.div className={cardClass}>
          <MonthlyProfitCard
            key={`profit-${refreshKey}`}
            userId={userId}
            selectedMonth={selectedMonth}
            year={selectedYear}
          />
        </motion.div>
        <motion.div className={cardClass}>
          <MonthlyExpensesCard
            key={`expenses-${refreshKey}`}
            userId={userId}
            month={selectedMonth}
            year={selectedYear}
          />
        </motion.div>
      </motion.div>

      <motion.div className={cardClass}>
        <ProfitLossTrendChart
          key={`trend-${refreshKey}`}
          userId={userId}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
        />
      </motion.div>

      <motion.div className={cardClass}>
        <ProfitMarginPieChart
          key={`pie-${refreshKey}`}
          userId={userId}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
        />
      </motion.div>
    </motion.div>
  )
}
