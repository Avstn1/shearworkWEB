import React from 'react'

interface Props {
  title: string
  value: string | number
}

export default function StatsCard({ title, value }: Props) {
  return (
    <div className="panel flex h-[80px] flex-col justify-center p-3 sm:h-[90px]">
      <h3 className="stat-label mb-1">{title}</h3>
      <p className="stat-value text-xl sm:text-2xl">{value}</p>
    </div>
  )
}
