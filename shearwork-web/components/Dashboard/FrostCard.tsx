'use client'

import React from 'react'
import { motion } from 'framer-motion'

interface FrostCardProps {
  children: React.ReactNode
  className?: string
  id?: string
  'data-tutorial-id'?: string
  variants?: any
}

/**
 * Card wrapper used across the analytics dashboards. Graphite: a plain `.panel`
 * surface (no gradient, blur or accent glow). API unchanged so callers still work.
 */
export default function FrostCard({ children, className = '', ...rest }: FrostCardProps) {
  return (
    <motion.div className={`panel flex flex-1 flex-col p-4 sm:p-5 ${className}`} {...rest}>
      {children}
    </motion.div>
  )
}
