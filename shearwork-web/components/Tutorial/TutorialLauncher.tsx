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
    if (nextStep.beforeStep) {
      await nextStep.beforeStep(context)
    }
    setActiveStep(index)
    setForceModal(false)
  }, [context, steps])

  const openTutorial = useCallback(async () => {
    if (!user?.id || totalSteps === 0) return
    await markOpened()
    setIsOpen(true)
    await goToStep(0)
  }, [goToStep, markOpened, totalSteps, user?.id])

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
    if (!status.loaded || status.seen || isOpen) return
    if (!user?.id || totalSteps === 0) return
    void openTutorial()
  }, [isOpen, openTutorial, status.loaded, status.seen, totalSteps, user?.id])

  const useModal = isMobile || forceModal || !step?.selector

  const handleMissingTarget = useCallback(() => {
    setForceModal(true)
  }, [])

  const content = useMemo(() => {
    if (!isOpen || !step) return null
    if (useModal) {
      return (
        <TutorialModal
          isOpen={isOpen}
          step={step}
          stepIndex={activeStep}
          totalSteps={totalSteps}
          onNext={() => goToStep(Math.min(activeStep + 1, totalSteps - 1))}
          onPrev={() => goToStep(Math.max(activeStep - 1, 0))}
          onClose={closeTutorial}
          onFinish={finishTutorial}
        />
      )
    }

    return (
      <TutorialOverlay
        isOpen={isOpen}
        step={step}
        stepIndex={activeStep}
        totalSteps={totalSteps}
        onNext={() => goToStep(Math.min(activeStep + 1, totalSteps - 1))}
        onPrev={() => goToStep(Math.max(activeStep - 1, 0))}
        onClose={closeTutorial}
        onFinish={finishTutorial}
        onMissingTarget={handleMissingTarget}
      />
    )
  }, [
    activeStep,
    closeTutorial,
    finishTutorial,
    goToStep,
    handleMissingTarget,
    isOpen,
    step,
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
