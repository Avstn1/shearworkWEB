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
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm"
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
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111312] p-6 shadow-2xl"
        style={{ transition: reduceMotion ? 'none' : 'transform 200ms ease' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.25em] text-[#9ca3af]">Tutorial</p>
            <h2 id={titleId} className="mt-1 text-lg font-semibold text-white">
              {step.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-[#cbd5f5] transition hover:border-white/20 hover:text-white"
            aria-label="Close tutorial"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p id={descriptionId} className="mt-3 text-sm text-[#bdbdbd]">
          {step.description}
        </p>

        {step.imageSrc && (
          <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
            <img src={step.imageSrc} alt="" className="w-full" />
          </div>
        )}

        <div className="mt-6 flex items-center justify-between text-xs text-[#9ca3af]">
          <span>
            Step {stepIndex + 1} of {totalSteps}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPrev}
              disabled={stepIndex === 0}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-white transition hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
            <button
              type="button"
              onClick={stepIndex === totalSteps - 1 ? onFinish : onNext}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white transition hover:border-white/30"
            >
              {stepIndex === totalSteps - 1 ? 'Finish' : 'Next'}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return typeof window !== 'undefined' ? createPortal(content, document.body) : null
}
