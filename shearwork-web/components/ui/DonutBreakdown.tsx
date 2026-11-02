'use client'

import { useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { CHART_COLORS, CHART_MUTED } from '@/lib/chartTheme'

export type BreakdownItem = { name: string; value: number }

/**
 * Donut + ranked list. The donut fills the available height with the total (or the
 * hovered slice) in its centre; the list shows each item's share as a coloured bar so the
 * numbers read without the chart. Items named "Others" are drawn in a muted grey.
 */
export default function DonutBreakdown({
  items,
  unit = '',
  formatValue = (v: number) => v.toLocaleString(),
  totalLabel = 'Total',
}: {
  items: BreakdownItem[]
  /** Appended to values in the list, e.g. "bookings" */
  unit?: string
  formatValue?: (value: number) => string
  totalLabel?: string
}) {
  const [active, setActive] = useState<number | null>(null)
  const total = items.reduce((sum, i) => sum + (i.value || 0), 0)
  const colorFor = (i: number) => (items[i]?.name === 'Others' ? CHART_MUTED : CHART_COLORS[i % CHART_COLORS.length])
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0)
  const focus = active != null ? items[active] : null

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 items-center gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Donut */}
      <div className="relative mx-auto aspect-square h-full max-h-[260px] w-full max-w-[260px] min-h-[180px] sm:max-h-none sm:max-w-none">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={items}
              dataKey="value"
              nameKey="name"
              innerRadius="68%"
              outerRadius="100%"
              paddingAngle={items.length > 1 ? 2 : 0}
              cornerRadius={4}
              stroke="none"
              isAnimationActive={false}
              onMouseLeave={() => setActive(null)}
            >
              {items.map((_, i) => (
                <Cell
                  key={i}
                  fill={colorFor(i)}
                  opacity={active == null || active === i ? 1 : 0.35}
                  onMouseEnter={() => setActive(i)}
                  style={{ transition: 'opacity 150ms ease', cursor: 'pointer' }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="max-w-[60%] truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            {focus ? focus.name : totalLabel}
          </span>
          <span className="mt-0.5 text-2xl font-semibold tabular-nums text-ivory">
            {focus ? `${pct(focus.value)}%` : formatValue(total)}
          </span>
          {focus && <span className="text-xs tabular-nums text-muted">{formatValue(focus.value)}{unit && ` ${unit}`}</span>}
        </div>
      </div>

      {/* Ranked list */}
      <ul className="min-w-0 space-y-3 self-center">
        {items.map((item, i) => (
          <li
            key={item.name}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            className={`rounded-md px-1.5 py-1 transition-colors ${active === i ? 'bg-white/[0.04]' : ''}`}
          >
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="flex min-w-0 items-center gap-2 text-gray-200">
                <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: colorFor(i) }} />
                <span className="truncate">{item.name}</span>
              </span>
              <span className="shrink-0 tabular-nums text-gray-400">
                {formatValue(item.value)}
                <span className="ml-2 inline-block w-9 text-right text-ivory">{pct(item.value)}%</span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full" style={{ width: `${pct(item.value)}%`, backgroundColor: colorFor(i) }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
