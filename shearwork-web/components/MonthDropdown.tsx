'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

interface MonthDropdownProps {
  selectedMonth: string
  setSelectedMonth: (month: string) => void
  disabled?: boolean
}

export default function MonthDropdown({ selectedMonth, setSelectedMonth, disabled }: MonthDropdownProps) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selected pill */}
      <button
        disabled={disabled}
        onClick={() => !disabled && setOpen(prev => !prev)}
        className={`
          flex items-center gap-2 px-4 py-1.5 rounded-full font-semibold text-sm transition-all duration-200
          ${open
            ? 'bg-gradient-to-r from-amber-300 to-lime-300 text-black shadow-[0_0_6px_#fffb85]'
            : 'bg-white/10 text-white hover:bg-white/20'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {selectedMonth.slice(0, 3)}
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="absolute z-20 mt-2 w-32 bg-[#1a1f1b]/95 backdrop-blur-lg border border-white/10 rounded-2xl shadow-lg overflow-hidden"
          >
            {MONTHS.map(month => (
              <button
                key={month}
                onClick={() => {
                  setSelectedMonth(month)
                  setOpen(false)
                }}
                className={`
                  w-full text-left px-4 py-2 text-sm font-medium transition-all duration-150
                  ${selectedMonth === month
                    ? 'bg-gradient-to-r from-amber-300 to-lime-300 text-black'
                    : 'text-white hover:bg-white/10'}
                `}
              >
                {month}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
