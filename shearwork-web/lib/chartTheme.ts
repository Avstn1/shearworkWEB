/**
 * Shared chart styling for the Graphite app. Series colours follow the accent tones in
 * globals.css (sage, sky, sand, violet, coral, teal) so charts and stat cards match.
 */
export const CHART_COLORS = ['#3DD27A', '#5AA9FF', '#FFB547', '#A78BFA', '#FF7A66', '#2DD4BF']
export const CHART_MUTED = '#5A6474'

export const CHART_GRID = 'rgba(255,255,255,0.06)'
export const CHART_AXIS = { fill: '#7B8596', fontSize: 11 }

export const CHART_TOOLTIP = {
  contentStyle: {
    backgroundColor: '#1C212A',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    color: '#EEF1F5',
    padding: '8px 12px',
    fontSize: 12,
    boxShadow: '0 12px 30px -12px rgba(0,0,0,0.8)',
  },
  itemStyle: { color: '#EEF1F5', fontWeight: 500 },
  labelStyle: { color: '#9AA3B2', fontWeight: 600 },
} as const
