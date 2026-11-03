'use client'

import { useLayoutEffect, useRef, useState } from 'react'

/**
 * How many rows of a list fit in its container without scrolling. Attach `ref` to the
 * element that has the fixed/flex height. Rows are its direct children, or the elements
 * matching `rowSelector` (e.g. 'tbody tr'); a <thead> inside is subtracted.
 * Cards never scroll internally: render `items.slice(0, count)` and offer "Show all".
 */
export function useFitCount<T extends HTMLElement = HTMLUListElement>(
  options: { fallbackRowHeight?: number; gap?: number; rowSelector?: string; deps?: unknown[] } = {},
) {
  const { fallbackRowHeight = 64, gap = 0, rowSelector, deps = [] } = options
  const ref = useRef<T | null>(null)
  const [count, setCount] = useState(50)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const first = (rowSelector ? el.querySelector(rowSelector) : el.firstElementChild) as HTMLElement | null
      const rowHeight = first?.offsetHeight || fallbackRowHeight
      const header = (el.querySelector('thead') as HTMLElement | null)?.offsetHeight ?? 0
      const available = el.clientHeight - header
      setCount(Math.max(1, Math.floor((available + gap + 1) / (rowHeight + gap))))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { ref, count }
}
