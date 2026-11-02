import React from 'react'

// Color palette
const COLORS = {
  background: '#161917',
  cardBg: '#181B19',
  navBg: '#161917', 
  surface: 'rgba(236, 237, 234, 0.05)',
  surfaceSolid: '#171A18',
  glassBorder: 'rgba(236, 237, 234, 0.09)',
  text: '#ECEDEA',
  textMuted: 'rgba(236, 237, 234, 0.62)',
  green: '#8FB57A',
  greenLight: '#8FB57A',
  greenGlow: 'rgba(143, 181, 122, 0.4)',
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