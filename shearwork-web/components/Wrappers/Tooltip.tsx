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
    <div className="relative group flex justify-center items-center z-30">
      {children}

      <div
        role="tooltip"
        className="
          absolute top-full mt-2 z-40
          pointer-events-none whitespace-nowrap
          opacity-0 group-hover:opacity-100 group-focus-within:opacity-100
          transition-opacity duration-150
          rounded-md border border-white/[0.12] bg-raised
          px-2 py-1 text-xs font-medium text-ivory
          shadow-[0_8px_24px_-8px_rgb(0_0_0/0.7)]
        "
      >
        {label}
      </div>
    </div>
  )
}
