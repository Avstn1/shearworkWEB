import type { TutorialStep } from '@/components/Tutorial/types'

export const SETTINGS_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'settings-tabs',
    title: 'Settings navigation',
    description: 'Use the sidebar to switch between profile, billing, and integrations.',
    selector: '[data-tutorial-id="settings-tabs"]',
  },
  {
    id: 'settings-profile',
    title: 'Profile details',
    description: 'Keep your personal and business details up to date.',
    selector: '[data-tutorial-id="settings-tab-profile"]',
    beforeStep: (context) => context?.setActiveTab?.('profile'),
  },
  {
    id: 'settings-billing',
    title: 'Billing overview',
    description: 'Manage your subscription and credit purchases here.',
    selector: '[data-tutorial-id="settings-tab-billing"]',
    beforeStep: (context) => context?.setActiveTab?.('billing'),
  },
  {
    id: 'settings-integrations',
    title: 'Integrations',
    description: 'Connect Square or Acuity to sync appointments and services.',
    selector: '[data-tutorial-id="settings-tab-square"]',
    beforeStep: (context) => context?.setActiveTab?.('square'),
  },
]
