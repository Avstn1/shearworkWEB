import type { TutorialStep } from '@/components/Tutorial/types'

export const CLIENT_MANAGER_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'client-manager-tabs',
    title: 'Navigate client tools',
    description: 'Switch between sheets, Auto‑Nudge, and campaigns from here.',
    selector: '[data-tutorial-id="client-manager-tabs"]',
  },
  {
    id: 'client-manager-sheets',
    title: 'Client sheets',
    description: 'View client profiles, visit history, and notes in one place.',
    selector: '[data-tutorial-id="client-manager-sheets"]',
    beforeStep: (context) => context?.setActiveView?.('sheets'),
  },
  {
    id: 'client-manager-campaigns',
    title: 'SMS campaigns',
    description: 'Create one-time campaigns and preview recipients before sending.',
    selector: '[data-tutorial-id="client-manager-campaigns"]',
    beforeStep: (context) => context?.setActiveView?.('sms-campaign'),
  },
  {
    id: 'client-manager-auto-nudge',
    title: 'Auto‑Nudge',
    description: 'Build automated nudges and review draft messaging flows.',
    selector: '[data-tutorial-id="client-manager-auto-nudge"]',
    beforeStep: (context) => context?.setActiveView?.('sms'),
  },
]
