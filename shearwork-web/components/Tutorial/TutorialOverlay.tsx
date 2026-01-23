'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { TutorialStep } from './types'

type TutorialOverlayProps = {
  isOpen: boolean
  step: TutorialStep
  stepIndex: number
  totalSteps: number
  onNext: () => void
  onPrev: () => void
  onClose: () => void
  onFinish: () => void
  onMissingTarget: () => void
}

const getFocusable = (container: HTMLElement | null) => {
  if (!container) return []
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ).filter(el => !el.hasAttribute('disabled'))
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export default function TutorialOverlay({
  isOpen,
  step,
  stepIndex,
  totalSteps,
  onNext,
  onPrev,
  onClose,
  onFinish,
  onMissingTarget,
}: TutorialOverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null)
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
    panelRef.current?.focus()
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
        const focusable = getFocusable(panelRef.current)
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

  useEffect(() => {
    if (!isOpen || !step.selector) {
      setSpotlightRect(null)
      return
    }

    const selector = step.selector

    let frameId = 0
    let timeoutId: ReturnType<typeof setTimeout>

    const updateRect = () => {
      const target = document.querySelector(selector) as HTMLElement | null
      if (!target) {
        setSpotlightRect(null)
        onMissingTarget()
        return
      }

      const rect = target.getBoundingClientRect()
      const inView = rect.top >= 0 && rect.bottom <= window.innerHeight
      if (!inView) {
        target.scrollIntoView({
          behavior: reduceMotion ? 'auto' : 'smooth',
          block: 'center',
        })
      }
      setSpotlightRect(rect)
    }

    frameId = window.requestAnimationFrame(updateRect)
    timeoutId = setTimeout(updateRect, 150)

    const handleResize = () => updateRect()
    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleResize, true)

    return () => {
      window.cancelAnimationFrame(frameId)
      clearTimeout(timeoutId)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleResize, true)
    }
  }, [isOpen, onMissingTarget, reduceMotion, step.selector])

  if (!isOpen) return null

  const padding = 10
  const spotlightStyle = spotlightRect
    ? {
        top: clamp(spotlightRect.top - padding, 8, window.innerHeight - padding),
        left: clamp(spotlightRect.left - padding, 8, window.innerWidth - padding),
        width: Math.min(spotlightRect.width + padding * 2, window.innerWidth - 16),
        height: Math.min(spotlightRect.height + padding * 2, window.innerHeight - 16),
      }
    : null

  const content = (
    <div
      className="fixed inset-0 z-[80]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      {spotlightStyle && (
        <div
          className="fixed rounded-2xl border border-white/30 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)]"
          style={spotlightStyle}
        />
      )}

      <div
        ref={panelRef}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="fixed bottom-6 right-6 w-full max-w-sm rounded-2xl border border-white/10 bg-[#111312]/95 p-5 shadow-2xl"
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

        <div className="mt-5 flex items-center justify-between text-xs text-[#9ca3af]">
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
