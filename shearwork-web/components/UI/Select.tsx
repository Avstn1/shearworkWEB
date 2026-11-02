'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

interface Option {
  value: string
  label: string
}

interface SelectProps {
  options: Option[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export default function Select({ options, value, onChange, disabled }: SelectProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedLabel = options.find(opt => opt.value === value)?.label || 'Select...'

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const btnClass = `field flex items-center justify-between text-left transition-colors hover:border-white/[0.16] ${
    disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
  }`

  const optionClass = (selected: boolean) =>
    `w-full cursor-pointer select-none px-3 py-1.5 text-left text-sm transition-colors ${selected ? 'bg-sage/[0.12] text-sage-bright' : 'text-gray-300 hover:bg-white/[0.05] hover:text-ivory'}`

  const dropdownClass = 'absolute left-0 right-0 z-50 mt-1 max-h-72 overflow-y-auto rounded-lg border border-white/[0.12] bg-raised py-1 shadow-lg'


  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        className={btnClass}
        onClick={() => !disabled && setOpen(prev => !prev)}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-gray-400" strokeWidth={1.75} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            role="listbox"
            className={dropdownClass}
          >
            {options.map(opt => (
              <li
                key={opt.value}
                role="option"
                aria-selected={opt.value === value}
                className={optionClass(opt.value === value)}
                onClick={() => {
                  onChange(opt.value)
                  setOpen(false)
                }}
              >
                {opt.label}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
