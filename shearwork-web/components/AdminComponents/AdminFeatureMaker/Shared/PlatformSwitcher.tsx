'use client'

import { Globe, Smartphone, MonitorSmartphone } from 'lucide-react'

interface PlatformSwitcherProps {
  currentPlatform: 'web' | 'mobile' | 'both'
  onPlatformChange: (platform: 'web' | 'mobile' | 'both') => void
}

const OPTIONS = [
  { value: 'web', label: 'Web', Icon: Globe },
  { value: 'mobile', label: 'Mobile', Icon: Smartphone },
  { value: 'both', label: 'Web & Mobile', Icon: MonitorSmartphone },
] as const

export default function PlatformSwitcher({ currentPlatform, onPlatformChange }: PlatformSwitcherProps) {
  return (
    <div className="segmented w-full sm:w-auto" role="tablist">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={currentPlatform === value}
          data-active={currentPlatform === value}
          onClick={() => onPlatformChange(value)}
          className="segmented-item flex items-center justify-center gap-1.5"
        >
          <Icon size={16} strokeWidth={1.75} />
          {label}
        </button>
      ))}
    </div>
  )
}
