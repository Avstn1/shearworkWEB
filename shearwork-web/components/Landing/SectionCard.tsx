import React from 'react'

interface Props {
  title: string
  loading: boolean
  error: string | null
  children: React.ReactNode
  className?: string
}

export default function SectionCard({ title, loading, error, children, className }: Props) {
  return (
    <div
      className={`bg-[var(--accent-1)]/10 backdrop-blur-sm rounded-2xl p-5 shadow-md border border-[var(--accent-2)]/30 flex flex-col ${className || ''}`}
    >
      <h2 className="text-xl font-semibold mb-3 text-[var(--accent-2)]">{title}</h2>

      {loading ? (
        <p className="text-[var(--text-muted)]">Loading...</p>
      ) : error ? (
        <p className="text-red-500">Error: {error}</p>
      ) : (
        <div className="flex-1">{children}</div>
      )}
    </div>
  )
}
