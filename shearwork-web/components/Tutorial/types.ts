export type TutorialContext = {
  setActiveView?: (view: string) => void
  setActiveTab?: (tab: string) => void
}

export type TutorialStep = {
  id: string
  title: string
  description: string
  selector?: string
  imageSrc?: string
  placement?: 'top' | 'right' | 'bottom' | 'left'
  beforeStep?: (context?: TutorialContext) => void | Promise<void>
}
