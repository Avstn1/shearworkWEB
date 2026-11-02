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
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen(prev => !prev)}
        className={`flex h-9 items-center justify-between gap-2 rounded-lg border border-white/[0.09] bg-canvas px-3 text-sm font-medium text-ivory transition-colors hover:border-white/[0.16] min-w-[84px] ${open ? 'border-white/[0.16]' : ''} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
      >
        {selectedMonth.slice(0, 3)}
        <ChevronDown
          strokeWidth={1.75}
          className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            role="listbox"
            className="absolute z-20 mt-1 max-h-72 w-36 overflow-y-auto rounded-lg border border-white/[0.12] bg-raised py-1 shadow-lg"
          >
            {MONTHS.map(month => (
              <button
                key={month}
                type="button"
                role="option"
                aria-selected={selectedMonth === month}
                onClick={() => {
                  setSelectedMonth(month)
                  setOpen(false)
                }}
                className={`w-full cursor-pointer select-none px-3 py-1.5 text-left text-sm transition-colors ${selectedMonth === month ? 'bg-sage/[0.12] text-sage-bright' : 'text-gray-300 hover:bg-white/[0.05] hover:text-ivory'}`}
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
