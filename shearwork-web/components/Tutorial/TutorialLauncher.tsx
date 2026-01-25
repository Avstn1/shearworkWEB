'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useIsMobile } from '@/hooks/useIsMobile'
import TutorialModal from './TutorialModal'
import TutorialOverlay from './TutorialOverlay'
import type { TutorialContext, TutorialStep } from './types'

type TutorialStatus = {
  loaded: boolean
  seen: boolean
  completed: boolean
  dismissed: boolean
}

type TutorialLauncherProps = {
  pageKey: string
  steps: TutorialStep[]
  version?: number
  context?: TutorialContext
  renderTrigger?: (openTutorial: () => void) => React.ReactNode
}

const defaultStatus: TutorialStatus = {
  loaded: false,
  seen: false,
  completed: false,
  dismissed: false,
}

export default function TutorialLauncher({
  pageKey,
  steps,
  version = 1,
  context,
  renderTrigger,
}: TutorialLauncherProps) {
  const { user, isLoading } = useAuth()
  const isMobile = useIsMobile(768)
  const [status, setStatus] = useState<TutorialStatus>(defaultStatus)
  const [isOpen, setIsOpen] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [forceModal, setForceModal] = useState(false)
  const [overlayBlocked, setOverlayBlocked] = useState(false)
  const [fadeOutSpotlight, setFadeOutSpotlight] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [previousUseModal, setPreviousUseModal] = useState<boolean | null>(null)

  const totalSteps = steps.length
  const step = steps[activeStep]

  const fetchStatus = useCallback(async () => {
    if (!user?.id) return
    try {
      const response = await fetch(`/api/tutorials/status?page_key=${pageKey}&version=${version}`)
      if (!response.ok) {
        setStatus(prev => ({ ...prev, loaded: true }))
        return
      }
      const data = await response.json()
      setStatus({
        loaded: true,
        seen: Boolean(data?.seen),
        completed: Boolean(data?.completed),
        dismissed: Boolean(data?.dismissed),
      })
    } catch (error) {
      console.error('Tutorial status error:', error)
      setStatus(prev => ({ ...prev, loaded: true }))
    }
  }, [pageKey, user?.id, version])

  useEffect(() => {
    if (isLoading) return
    void fetchStatus()
  }, [fetchStatus, isLoading])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const update = () => {
      const body = document.body
      const blocked =
        body.classList.contains('tutorial-hide-credits') ||
        body.classList.contains('tutorial-hide-profile') ||
        body.classList.contains('tutorial-hide-features')
      setOverlayBlocked(blocked)
    }

    update()
    const observer = new MutationObserver(update)
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const className = 'tutorial-overlay-open'
    if (isOpen) {
      document.body.classList.add(className)
    } else {
      document.body.classList.remove(className)
    }

    return () => {
      document.body.classList.remove(className)
    }
  }, [isOpen])

  const markOpened = useCallback(async () => {
    try {
      await fetch('/api/tutorials/opened', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_key: pageKey, version }),
      })
    } catch (error) {
      console.error('Tutorial open error:', error)
    }
  }, [pageKey, version])

  const markCompleted = useCallback(async () => {
    try {
      await fetch('/api/tutorials/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_key: pageKey, version }),
      })
      setStatus(prev => ({ ...prev, completed: true, dismissed: false, seen: true }))
    } catch (error) {
      console.error('Tutorial complete error:', error)
    }
  }, [pageKey, version])

  const markDismissed = useCallback(async () => {
    try {
      await fetch('/api/tutorials/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_key: pageKey, version }),
      })
      setStatus(prev => ({ ...prev, dismissed: true, seen: true }))
    } catch (error) {
      console.error('Tutorial dismiss error:', error)
    }
  }, [pageKey, version])

  const goToStep = useCallback(async (index: number) => {
    const nextStep = steps[index]
    if (!nextStep) return
    
    // Fade out spotlight immediately when navigation starts
    setFadeOutSpotlight(true)
    
    // Small delay to let fade out start
    await new Promise(resolve => setTimeout(resolve, 50))
    
    // Run beforeStep if it exists FIRST
    if (nextStep.beforeStep) {
      await nextStep.beforeStep(context)
      
      // Wait for React to flush updates and DOM to settle
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // If there's a selector, wait for it to appear in DOM
      if (nextStep.selector) {
        let attempts = 0
        const maxAttempts = 20
        while (attempts < maxAttempts) {
          const element = document.querySelector(nextStep.selector)
          if (element) {
            // Wait an additional 500ms after finding to ensure everything is stable
            await new Promise(resolve => setTimeout(resolve, 500))
            break
          }
          await new Promise(resolve => setTimeout(resolve, 100))
          attempts++
        }
      }
    }
    
    // Then update the step (this will trigger fade in)
    setActiveStep(index)
    setForceModal(false)
    setFadeOutSpotlight(false)
  }, [context, steps])

  const openTutorial = useCallback(async () => {
    if (!user?.id || totalSteps === 0 || overlayBlocked) return
    await markOpened()
    setIsOpen(true)
    await goToStep(0)
  }, [goToStep, markOpened, overlayBlocked, totalSteps, user?.id])

  const closeTutorial = useCallback(async () => {
    setIsOpen(false)
    if (!status.completed) {
      await markDismissed()
    }
  }, [markDismissed, status.completed])

  const finishTutorial = useCallback(async () => {
    await markCompleted()
    setIsOpen(false)
  }, [markCompleted])

  useEffect(() => {
    if (!status.loaded || status.seen || isOpen || overlayBlocked) return
    if (!user?.id || totalSteps === 0) return
    void openTutorial()
  }, [isOpen, openTutorial, overlayBlocked, status.loaded, status.seen, totalSteps, user?.id])

  const useModal = isMobile || forceModal || !step?.selector || !!step?.videoSrc

  const handleMissingTarget = useCallback(() => {
    setForceModal(true)
  }, [])

  // Handle transitions between modal and overlay
  useEffect(() => {
    if (previousUseModal !== null && previousUseModal !== useModal) {
      // Component is switching, trigger transition
      setIsTransitioning(true)
      const timer = setTimeout(() => {
        setIsTransitioning(false)
        setPreviousUseModal(useModal)
      }, 300) // Match transition duration
      return () => clearTimeout(timer)
    } else if (previousUseModal === null) {
      // Initial render
      setPreviousUseModal(useModal)
    }
  }, [useModal, previousUseModal])

  const content = useMemo(() => {
    if (!isOpen || !step) return null
    
    const componentOpacity = isTransitioning ? 0 : 1
    const transitionStyle = {
      opacity: componentOpacity,
      transition: 'opacity 300ms ease-in-out',
    }
    
    if (useModal) {
      return (
        <div style={transitionStyle}>
          <TutorialModal
            isOpen={isOpen}
            step={step}
            stepIndex={activeStep}
            allSteps={steps}
            totalSteps={totalSteps}
            onNext={() => goToStep(Math.min(activeStep + 1, totalSteps - 1))}
            onPrev={() => goToStep(Math.max(activeStep - 1, 0))}
            onClose={closeTutorial}
            onFinish={finishTutorial}
          />
        </div>
      )
    }

    return (
      <div style={transitionStyle}>
        <TutorialOverlay
          isOpen={isOpen}
          step={step}
          stepIndex={activeStep}
          totalSteps={totalSteps}
          fadeOutSpotlight={fadeOutSpotlight}
          onNext={() => goToStep(Math.min(activeStep + 1, totalSteps - 1))}
          onPrev={() => goToStep(Math.max(activeStep - 1, 0))}
          onClose={closeTutorial}
          onFinish={finishTutorial}
          onMissingTarget={handleMissingTarget}
        />
      </div>
    )
  }, [
    activeStep,
    closeTutorial,
    fadeOutSpotlight,
    finishTutorial,
    goToStep,
    handleMissingTarget,
    isOpen,
    isTransitioning,
    step,
    steps,
    totalSteps,
    useModal,
  ])

  return (
    <>
      {renderTrigger ? renderTrigger(openTutorial) : null}
      {content}
    </>
  )
}