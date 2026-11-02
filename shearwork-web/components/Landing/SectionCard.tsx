import React from 'react'

// Color palette
const COLORS = {
  background: '#121513',
  cardBg: '#141716',
  navBg: '#121513', 
  surface: 'rgba(242, 245, 239, 0.05)',
  surfaceSolid: '#111412',
  glassBorder: 'rgba(242, 245, 239, 0.09)',
  text: '#F2F5EF',
  textMuted: 'rgba(242, 245, 239, 0.62)',
  green: '#C5F27A',
  greenLight: '#A9DB5C',
  greenGlow: 'rgba(197, 242, 122, 0.4)',
}

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
      className={`backdrop-blur-sm rounded-2xl p-5 shadow-md flex flex-col ${className || ''}`}
      style={{
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
      }}
    >
      <h2 
        className="text-xl font-semibold mb-3"
        style={{ color: COLORS.green }}
      >
        {title}
      </h2>

      {loading ? (
        <p style={{ color: COLORS.textMuted }}>Loading...</p>
      ) : error ? (
        <p className="text-red-500">Error: {error}</p>
      ) : (
        <div className="flex-1">{children}</div>
      )}
    </div>
  )
}