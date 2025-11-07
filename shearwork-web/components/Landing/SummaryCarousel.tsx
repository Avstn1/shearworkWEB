'use client'

import React, { useRef } from 'react'
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa'

export interface Summary {
  date: string
  revenue: number
  expenses: number
  total_clients: number
  returning_clients: number
  new_clients: number
  avg_ticket: number
  top_service: string
}

interface SummaryCarouselProps {
  summaries: Summary[]
}

export default function SummaryCarousel({ summaries }: SummaryCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const scroll = (dir: 'left' | 'right') => {
    if (!containerRef.current) return
    const amount = 260
    containerRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' })
  }

  return (
    <div className="relative w-full">
      {/* Scroll arrows */}
      <button
        onClick={() => scroll('left')}
        className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 bg-[var(--accent-3)]/80 text-[var(--background)] rounded-full p-2 shadow hover:scale-110 transition"
      >
        <FaChevronLeft size={16} />
      </button>

      <button
        onClick={() => scroll('right')}
        className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 bg-[var(--accent-3)]/80 text-[var(--background)] rounded-full p-2 shadow hover:scale-110 transition"
      >
        <FaChevronRight size={16} />
      </button>

      {/* Cards */}
      <div
        ref={containerRef}
        className="flex gap-4 overflow-x-auto scroll-smooth hide-scrollbar pb-2"
      >
        {summaries.map((s, idx) => (
          <div
            key={idx}
            className="flex-shrink-0 w-64 bg-[var(--accent-1)]/15 rounded-xl p-4 border border-[var(--accent-2)]/20 text-[var(--foreground)] shadow-sm hover:shadow-md transition"
          >
            <h3 className="text-base font-semibold text-[var(--accent-3)] mb-1">{s.date}</h3>
            <div className="text-sm space-y-0.5">
              <p>Revenue: ${s.revenue}</p>
              <p>Expenses: ${s.expenses}</p>
              <p>Total Clients: {s.total_clients}</p>
              <p>Returning: {s.returning_clients}</p>
              <p>New: {s.new_clients}</p>
              <p>Avg Ticket: ${s.avg_ticket.toFixed(2)}</p>
              <p>Top: {s.top_service}</p>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          scrollbar-width: none;
        }
      `}</style>
    </div>
  )
}
