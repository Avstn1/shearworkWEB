'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { TutorialStep } from './types'

type TutorialModalProps = {
  isOpen: boolean
  step: TutorialStep
  stepIndex: number
  totalSteps: number
  onNext: () => void
  onPrev: () => void
  onClose: () => void
  onFinish: () => void
}

const getFocusable = (container: HTMLElement | null) => {
  if (!container) return []
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ).filter(el => !el.hasAttribute('disabled'))
}

export default function TutorialModal({
  isOpen,
  step,
  stepIndex,
  totalSteps,
  onNext,
  onPrev,
  onClose,
  onFinish,
}: TutorialModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduceMotion(media.matches)
    const handleChange = () => setReduceMotion(media.matches)
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const body = document.body
    const previousOverflow = body.style.overflow
    body.style.overflow = 'hidden'
    const focusTarget = dialogRef.current
    focusTarget?.focus()
    return () => {
      body.style.overflow = previousOverflow
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        stepIndex === totalSteps - 1 ? onFinish() : onNext()
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        if (stepIndex > 0) onPrev()
      }
      if (event.key === 'Tab') {
        const focusable = getFocusable(dialogRef.current)
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, onFinish, onNext, onPrev, stepIndex, totalSteps])

  if (!isOpen) return null

  const content = (
    <div
      className="modal-backdrop z-[80] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="modal-surface w-full max-w-md p-6 outline-none"
        style={{ transition: reduceMotion ? 'none' : 'transform 200ms ease' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="stat-label">Tutorial</p>
            <h2 id={titleId} className="mt-1 text-[15px] font-semibold tracking-tight text-ivory">
              {step.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-sm h-8 w-8 shrink-0 !px-0"
            aria-label="Close tutorial"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        <p id={descriptionId} className="mt-3 text-sm leading-relaxed text-gray-400">
          {step.description}
        </p>

        {step.imageSrc && (
          <div className="mt-4 overflow-hidden rounded-lg border border-white/[0.07]">
            <img src={step.imageSrc} alt="" className="w-full" />
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3 text-xs tabular-nums text-gray-500">
          <span>
            Step {stepIndex + 1} of {totalSteps}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPrev}
              disabled={stepIndex === 0}
              className="btn btn-glass btn-sm"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
              Back
            </button>
            <button
              type="button"
              onClick={stepIndex === totalSteps - 1 ? onFinish : onNext}
              className="btn btn-primary btn-sm"
            >
              {stepIndex === totalSteps - 1 ? 'Finish' : 'Next'}
              <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return typeof window !== 'undefined' ? createPortal(content, document.body) : null
}
