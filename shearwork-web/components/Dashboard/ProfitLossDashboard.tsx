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

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

export default function ProfitLossDashboard({
  userId,
  selectedMonth,
  selectedYear,
  selectedDay,
  globalRefreshKey,
}: {
  userId: string
  selectedMonth: string
  selectedYear: number
  selectedDay: number
  globalRefreshKey?: number
}) {
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    setRefreshKey((prev) => prev + 1)
  }, [selectedMonth, selectedYear, selectedDay, globalRefreshKey])

  const statClass = 'panel flex flex-col p-4 sm:p-5'
  const cardClass = 'panel flex flex-1 flex-col p-4 sm:p-5'

  return (
    <motion.div
      className="flex flex-col gap-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div variants={fadeInUp} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <motion.div className={statClass}>
          <DailyRevenueCard
            key={`daily-${refreshKey}`}
            userId={userId}
            selectedDate={`${selectedYear}-${String(MONTHS.indexOf(selectedMonth)+1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`}
          />
        </motion.div>
        <motion.div className={statClass}>
          <MonthlyRevenueCard
            key={`revenue-${refreshKey}`}
            userId={userId}
            selectedMonth={selectedMonth}
            year={selectedYear}
          />
        </motion.div>
        <motion.div className={statClass}>
          <MonthlyProfitCard
            key={`profit-${refreshKey}`}
            userId={userId}
            selectedMonth={selectedMonth}
            year={selectedYear}
          />
        </motion.div>
        <motion.div className={statClass}>
          <MonthlyExpensesCard
            key={`expenses-${refreshKey}`}
            userId={userId}
            month={selectedMonth}
            year={selectedYear}
          />
        </motion.div>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
      </div>
    </motion.div>
  )
}
