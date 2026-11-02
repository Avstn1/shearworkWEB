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
        className={`tutorial-info-button btn btn-ghost btn-sm h-9 w-9 !px-0 ${className}`}
      >
        <Info className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </button>
    </Tooltip>
  )
}
