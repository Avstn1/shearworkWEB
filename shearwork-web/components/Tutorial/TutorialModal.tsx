'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X, Maximize2, Minimize2 } from 'lucide-react'
import type { TutorialStep } from './types'
import { supabase } from '@/utils/supabaseClient'

type TutorialModalProps = {
  isOpen: boolean
  step: TutorialStep
  stepIndex: number
  totalSteps: number
  allSteps: TutorialStep[]
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
  allSteps,
  onNext,
  onPrev,
  onClose,
  onFinish,
}: TutorialModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const [reduceMotion, setReduceMotion] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string>('')
  const [isMounted, setIsMounted] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)
  const [preloadedVideos, setPreloadedVideos] = useState<Record<string, string>>({})
  const [isNextDisabled, setIsNextDisabled] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduceMotion(media.matches)
    const handleChange = () => setReduceMotion(media.matches)
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    if (isOpen) {
      // Preload all videos before showing modal
      const preloadVideos = async () => {
        const videoSteps = allSteps.filter(s => s.videoSrc)
        
        if (videoSteps.length === 0) {
          // No videos to preload, show modal immediately
          setShouldRender(true)
          requestAnimationFrame(() => {
            setIsMounted(true)
          })
          return
        }
        
        const preloaded: Record<string, string> = {}
        
        await Promise.all(
          videoSteps.map(async (videoStep) => {
            const { data, error } = await supabase.storage
              .from('tutorial_videos')
              .createSignedUrl(videoStep.videoSrc!, 360)
            
            if (data && !error) {
              preloaded[videoStep.videoSrc!] = data.signedUrl
            }
          })
        )
        
        setPreloadedVideos(preloaded)
        
        // Show modal after videos are preloaded
        await new Promise(resolve => setTimeout(resolve, 100))
        setShouldRender(true)
        requestAnimationFrame(() => {
          setIsMounted(true)
        })
      }
      
      preloadVideos()
    } else {
      setIsMounted(false)
      const timer = setTimeout(() => {
        setShouldRender(false)
        setIsExpanded(false)
        setPreloadedVideos({})
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [isOpen, allSteps])

  useEffect(() => {
    if (step.videoSrc && preloadedVideos[step.videoSrc]) {
      setVideoUrl(preloadedVideos[step.videoSrc])
    } else {
      setVideoUrl('')
      setIsExpanded(false)
    }
  }, [step, stepIndex, preloadedVideos])

  useEffect(() => {
    if (!isOpen) return
    const focusTarget = dialogRef.current
    focusTarget?.focus()
  }, [isOpen])

  const handleNext = useCallback(() => {
    if (isNextDisabled) return
    
    setIsNextDisabled(true)
    
    if (stepIndex === totalSteps - 1) {
      onFinish()
    } else {
      onNext()
    }
    
    setTimeout(() => {
      setIsNextDisabled(false)
    }, 2000)
  }, [isNextDisabled, stepIndex, totalSteps, onFinish, onNext])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        handleNext()
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
  }, [isOpen, onClose, handleNext, onPrev, stepIndex])

  if (!shouldRender) return null

  const hasVideo = !!videoUrl

  // Determine position and size
  const getModalClasses = () => {
    if (!hasVideo) return 'w-full max-w-md'
    if (isExpanded) return 'h-[80vh] w-[55.5vw]'
    return 'w-[400px]' // Small video size
  }

  const getModalPosition = () => {
    if (!hasVideo) return 'items-center justify-center'
    if (isExpanded) return 'items-center justify-center'
    return 'items-end justify-end pb-6 pr-6' // Bottom right
  }

  const getTransformOrigin = () => {
    if (!hasVideo) return 'center'
    return 'bottom right' // Expand from bottom-right corner
  }

  const getVideoHeight = () => {
    if (isExpanded) return 'h-[calc(100%-12rem)]'
    return 'h-[225px]' // Small video height (16:9 aspect for 400px width)
  }

  const content = (
    <div
      className={`fixed inset-0 z-[80] flex transition-all duration-300 ${getModalPosition()} ${
        isExpanded ? 'bg-black/70 backdrop-blur-sm' : 'bg-transparent'
      } ${isExpanded ? '' : 'pointer-events-none'}`}
      style={{ transition: reduceMotion ? 'none' : undefined }}
      onClick={isExpanded ? onClose : undefined}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className={`${getModalClasses()} rounded-2xl border border-white/10 bg-[#111312] p-6 shadow-2xl pointer-events-auto transition-all duration-300 ease-out ${
          isMounted ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
        style={{ 
          transition: reduceMotion ? 'none' : 'all 300ms ease-out',
          transformOrigin: getTransformOrigin(),
        }}
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
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-[#cbd5f5] transition-all duration-200 hover:border-white/20 hover:text-white"
            aria-label="Close tutorial"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p id={descriptionId} className="mt-3 text-sm text-[#bdbdbd]">
          {step.description}
        </p>

        {videoUrl && (
          <div className="relative mt-4">
            <div className={`flex ${getVideoHeight()} items-center justify-center overflow-hidden rounded-xl border border-white/10 transition-all duration-300`}>
              <video
                key={videoUrl}
                ref={videoRef}
                src={videoUrl}
                className="h-full w-full object-contain"
                autoPlay
                loop
                muted
                playsInline
                controls={isExpanded}
              />
            </div>
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="absolute top-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white backdrop-blur-sm transition-all duration-200 hover:border-white/40 hover:bg-black/80"
              aria-label={isExpanded ? 'Minimize video' : 'Expand video'}
            >
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        )}

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
              className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-white transition-all duration-200 hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={isNextDisabled}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white transition-all duration-200 hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-50"
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