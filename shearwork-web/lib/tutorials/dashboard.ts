import type { TutorialStep } from '@/components/Tutorial/types'

export const DASHBOARD_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'dashboard-view-switcher',
    title: 'Switch dashboard views',
    description: 'Toggle between monthly, yearly, and profit views for the insights you need.',
    selector: '[data-tutorial-id="dashboard-view-switcher"]',
  },
  {
    id: 'dashboard-date-controls',
    title: 'Set your timeframe',
    description: 'Pick the month, day, and year to update the cards and charts.',
    selector: '[data-tutorial-id="dashboard-date-controls"]',
  },
  {
    id: 'dashboard-weekly-reports',
    title: 'Weekly reports',
    description: 'Review weekly performance, tips, and client trends at a glance.',
    selector: '[data-tutorial-id="dashboard-weekly-reports"]',
  },
  {
    id: 'dashboard-monthly-reports',
    title: 'Monthly reports',
    description: 'Track revenue and expense summaries for the selected month.',
    selector: '[data-tutorial-id="dashboard-monthly-reports"]',
  },
  {
    id: 'dashboard-weekly-comparison',
    title: 'Weekly comparison',
    description: 'Compare performance week over week to spot momentum changes.',
    selector: '[data-tutorial-id="dashboard-weekly-comparison"]',
  },
]
