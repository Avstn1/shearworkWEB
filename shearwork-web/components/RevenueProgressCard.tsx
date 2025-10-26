'use client'

import React from 'react'
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar'
import 'react-circular-progressbar/dist/styles.css'
import { motion } from 'framer-motion'

interface Props {
  actual: number
  projected: number
  className?: string
}

export default function RevenueProgressCard({ actual, projected, className }: Props) {
  const percentage = Math.min((actual / projected) * 100, 100)

  return (
    <motion.div
      className={`bg-[var(--accent-1)]/10 backdrop-blur-sm rounded-2xl p-6 shadow-md border border-[var(--accent-2)]/30 flex flex-col items-center justify-center ${className}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3, duration: 0.6 }}
    >
      <h2 className="text-xl font-semibold mb-4 text-[var(--accent-2)]">Revenue Progress</h2>

      <div className="w-48 h-48">
        <CircularProgressbar
          value={percentage}
          text={`${Math.round(percentage)}%`}
          styles={buildStyles({
            textColor: 'var(--foreground)',
            pathColor: 'var(--accent-2)',
            trailColor: 'var(--accent-3)',
            textSize: '14px',
          })}
        />
      </div>

      <p className="mt-4 text-sm text-[var(--text-subtle)]">
        ${actual.toLocaleString()} / ${projected.toLocaleString()}
      </p>
    </motion.div>
  )
}
