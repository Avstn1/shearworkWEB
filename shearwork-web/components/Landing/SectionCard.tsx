import React from 'react'

// Color palette
const COLORS = {
  background: '#181818',
  cardBg: '#1a1a1a',
  navBg: '#1b1d1b', 
  surface: 'rgba(37, 37, 37, 0.6)',
  surfaceSolid: '#252525',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
  text: '#FFFFFF',
  textMuted: 'rgba(255, 255, 255, 0.6)',
  green: '#73aa57',
  greenLight: '#5b8f52',
  greenGlow: 'rgba(115, 170, 87, 0.4)',
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