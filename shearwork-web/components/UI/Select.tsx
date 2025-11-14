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

  const btnClass = `
    flex items-center justify-between p-3 rounded-xl border border-[var(--accent-2)]
    bg-black/90 text-white cursor-pointer hover:bg-black/80 transition-all
    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
  `

  const optionClass = `
    px-3 py-2 cursor-pointer rounded-xl
    hover:bg-[var(--highlight)] hover:text-black transition-all
  `

  const dropdownClass = `
    absolute left-0 right-0 mt-2 bg-black/95 border border-[var(--accent-2)]
    rounded-xl shadow-lg z-50 overflow-hidden
  `

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        className={btnClass}
        onClick={() => !disabled && setOpen(prev => !prev)}
      >
        <span>{selectedLabel}</span>
        <ChevronDown className="w-4 h-4 ml-2" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className={dropdownClass}
          >
            {options.map(opt => (
              <li
                key={opt.value}
                className={optionClass}
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
