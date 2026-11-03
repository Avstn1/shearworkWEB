import React from 'react'

// Color palette
const COLORS = {
  background: '#13171C',
  cardBg: '#161A21',
  navBg: '#13171C', 
  surface: 'rgba(238, 241, 245, 0.05)',
  surfaceSolid: '#151920',
  glassBorder: 'rgba(238, 241, 245, 0.09)',
  text: '#EEF1F5',
  textMuted: 'rgba(238, 241, 245, 0.62)',
  green: '#3DD27A',
  greenLight: '#3DD27A',
  greenGlow: 'rgba(61, 210, 122, 0.4)',
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