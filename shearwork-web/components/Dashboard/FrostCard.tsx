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
 * Deep Frost card surface — used as the single card wrapper across all dashboards.
 * Children render transparently inside (no inner card chrome).
 * 
 * Place at: components/Dashboard/FrostCard.tsx
 */
export default function FrostCard({ children, className = '', ...rest }: FrostCardProps) {
  return (
    <motion.div
      className={`relative overflow-hidden rounded-2xl p-4 flex flex-col flex-1 ${className}`}
      style={{
        background: 'linear-gradient(160deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.2), 0 8px 32px rgba(0,0,0,0.4)',
      }}
      {...rest}
    >
      {/* Frosted top-edge highlight */}
      <div
        className="absolute top-0 left-0 right-0 h-[1px] pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.15) 50%, transparent 95%)',
        }}
      />
      {/* Subtle violet corner accent */}
      <div
        className="absolute top-0 right-0 w-24 h-24 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at top right, rgba(167,139,250,0.08) 0%, transparent 70%)',
        }}
      />
      <div className="relative z-[1] flex flex-col flex-1">{children}</div>
    </motion.div>
  )
}