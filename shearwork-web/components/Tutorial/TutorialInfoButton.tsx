'use client'

import { Info } from 'lucide-react'
import Tooltip from '@/components/Wrappers/Tooltip'

type TutorialInfoButtonProps = {
  onClick: () => void
  label?: string
  className?: string
}

export default function TutorialInfoButton({
  onClick,
  label = 'Open tutorial',
  className = '',
}: TutorialInfoButtonProps) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={`tutorial-info-button inline-flex items-center justify-center h-9 w-9 rounded-full border border-white/10 bg-black/30 text-[#cbd5f5] transition hover:border-white/20 hover:text-white ${className}`}
      >
        <Info className="h-4 w-4" />
      </button>
    </Tooltip>
  )
}
