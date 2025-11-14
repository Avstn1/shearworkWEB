'use client'

import React from 'react'

export default function Tooltip({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="relative group flex justify-center items-center">
      {children}

      {/* Tooltip — themed for ShearWork */}
      <div
        className="
          absolute top-full mt-2
          opacity-0 group-hover:opacity-100 
          pointer-events-none 
          transition-all duration-200
          whitespace-nowrap 

          bg-gradient-to-r from-amber-300/90 to-lime-300/90
          text-black font-semibold text-xs 
          
          px-2 py-1 
          rounded-md shadow-[0_0_8px_rgba(255,255,255,0.25)]
          border border-white/20
          backdrop-blur-md
        "
      >
        {label}
      </div>
    </div>
  )
}
