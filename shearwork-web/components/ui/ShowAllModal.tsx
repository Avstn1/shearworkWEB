'use client'

import type { ReactNode } from 'react'
import { X } from 'lucide-react'

/** Full list in a modal, for cards that show only what fits ("Show all"). Modals may scroll; cards don't. */
export default function ShowAllModal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-surface relative z-[71] flex max-h-[85dvh] w-full flex-col sm:max-w-lg">
        <header className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-3.5">
          <h2 className="panel-title">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="btn btn-ghost btn-sm !h-8 !w-8 !p-0">
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2">{children}</div>
      </div>
    </div>
  )
}

/** Small footer button under a card's list: "Show all (N)". */
export function ShowAllButton({ total, onClick }: { total: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="btn btn-ghost btn-sm mt-1 w-full flex-shrink-0 text-xs">
      Show all ({total})
    </button>
  )
}
