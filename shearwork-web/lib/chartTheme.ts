/**
 * Shared chart styling for the Graphite app. Series colours follow the accent tones in
 * globals.css (sage, sky, sand, violet, coral, teal) so charts and stat cards match.
 */
export const CHART_COLORS = ['#8CC470', '#70A6DE', '#E2B86E', '#A08CE6', '#E88470', '#5FC2B5']
export const CHART_MUTED = '#5C615B'

export const CHART_GRID = 'rgba(255,255,255,0.06)'
export const CHART_AXIS = { fill: '#7C817A', fontSize: 11 }

export const CHART_TOOLTIP = {
  contentStyle: {
    backgroundColor: '#1D201E',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    color: '#ECEDEA',
    padding: '8px 12px',
    fontSize: 12,
    boxShadow: '0 12px 30px -12px rgba(0,0,0,0.8)',
  },
  itemStyle: { color: '#ECEDEA', fontWeight: 500 },
  labelStyle: { color: '#9EA39C', fontWeight: 600 },
} as const
