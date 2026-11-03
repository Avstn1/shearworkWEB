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
      className={`panel flex flex-col items-center justify-center p-6 ${className ?? ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3, duration: 0.6 }}
    >
      <h2 className="panel-title mb-4 self-start">Revenue Progress</h2>

      <div className="w-48 h-48">
        <CircularProgressbar
          value={percentage}
          text={`${Math.round(percentage)}%`}
          styles={buildStyles({
            textColor: '#EEF1F5',
            pathColor: '#3DD27A',
            trailColor: 'rgba(255,255,255,0.06)',
            textSize: '14px',
          })}
        />
      </div>

      <p className="mt-4 text-sm tabular-nums text-muted">
        ${actual.toLocaleString()} / ${projected.toLocaleString()}
      </p>
    </motion.div>
  )
}
