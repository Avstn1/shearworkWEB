import React from 'react'

interface Props {
  title: string
  value: string | number
}

export default function StatsCard({ title, value }: Props) {
  return (
    <div className="bg-[var(--text-bright)]/90 rounded-xl p-3 shadow-md border border-[var(--accent-1)]/10 flex flex-col justify-center h-[80px] sm:h-[90px] transition-all">
      <h3 className="text-[var(--text-subtle)] text-xs font-medium mb-1 tracking-wide">
        {title}
      </h3>
      <p className="text-xl sm:text-2xl font-extrabold text-[var(--text-dark)] leading-tight">
        {value}
      </p>
    </div>
  )
}
