'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

interface MonthPickerProps {
  selectedMonth: string
  onSelect: (month: string) => void
}

export default function MonthPicker({ selectedMonth, onSelect }: MonthPickerProps) {
  const [expanded, setExpanded] = useState(false)

  const handleSelect = (month: string) => {
    onSelect(month)
    setExpanded(false)
  }

  const unselectedMonths = MONTHS.filter(m => m !== selectedMonth)

  return (
    <div className="relative flex items-center justify-center mt-2 mb-4">
      <div className="flex items-center gap-2">
        {/* Selected (main) pill */}
        <motion.button
          layout
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          onClick={() => setExpanded(prev => !prev)}
          className="btn btn-glass btn-sm"
        >
          {selectedMonth}
        </motion.button>

        {/* Animate presence for the expanded months */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              layout
              className="flex items-center gap-2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ staggerChildren: 0.05, delayChildren: 0.05 }}
            >
              {unselectedMonths.map(month => (
                <motion.button
                  key={month}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ type: 'spring', stiffness: 250, damping: 20 }}
                  onClick={() => handleSelect(month)}
                  className="btn btn-ghost btn-sm"
                >
                  {month}
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
