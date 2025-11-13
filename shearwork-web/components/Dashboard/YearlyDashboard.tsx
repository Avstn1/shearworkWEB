'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import YearlyRevenueCard from '@/components/Dashboard/YearlyRevenueCard'
import AppointmentsByWeekdayChart from './AppointmentsByWeekdayChart'
import YearlyExpensesCard from './YearlyExpensesCard'

import { useIsMobile } from '@/hooks/useIsMobile'

interface YearlyDashboardProps {
  userId: string
  selectedYear: number
  globalRefreshKey: number
}

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number = 1) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
}

export default function YearlyDashboard({
  userId,
  selectedYear,
  globalRefreshKey,
}: YearlyDashboardProps) {
  const isMobile = useIsMobile(768)

  const cardClass =
    'bg-white/10 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl p-4 flex flex-col flex-1'

  return (
    <motion.div
      className={`grid gap-4 flex-1 ${
        isMobile
          ? 'grid-cols-1'
          : 'grid-cols-[minmax(250px,3fr)_minmax(200px,2fr)_minmax(150px,1fr)]'
      }`}
    >
      {/* LEFT COLUMN */}
      <div className="flex flex-col gap-4 pr-1">
        <motion.div variants={fadeInUp} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <motion.div className={cardClass}>
            <YearlyRevenueCard key={`yrevenue-${globalRefreshKey}`} userId={userId} year={selectedYear} />
          </motion.div>
          <motion.div className={cardClass}>
            <YearlyExpensesCard key={`yexpenses-${globalRefreshKey}`} userId={userId} year={selectedYear} />
          </motion.div>
        </motion.div>
        <motion.div variants={fadeInUp} className={cardClass}>
          <AppointmentsByWeekdayChart
            key={`yappointments-${globalRefreshKey}`}
            userId={userId}
            year={selectedYear}
          />
        </motion.div>
      </div>
    </motion.div>
  )
}
