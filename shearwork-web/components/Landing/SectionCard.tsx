import React from 'react'

// Color palette
const COLORS = {
  background: '#161913',
  cardBg: '#181b15',
  navBg: '#1a1d17', 
  surface: 'rgba(247, 245, 239, 0.05)',
  surfaceSolid: '#161A13',
  glassBorder: 'rgba(247, 245, 239, 0.09)',
  text: '#F4F3EC',
  textMuted: 'rgba(244, 243, 236, 0.62)',
  green: '#aab39a',
  greenLight: '#8e9a78',
  greenGlow: 'rgba(170, 179, 154, 0.4)',
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