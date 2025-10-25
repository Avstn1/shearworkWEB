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

  const scrollLeft = () => {
    if (!containerRef.current) return
    const cardWidth = containerRef.current.firstChild
      ? (containerRef.current.firstChild as HTMLElement).clientWidth + 24
      : 0
    containerRef.current.scrollBy({ left: -cardWidth, behavior: 'smooth' })
  }

  const scrollRight = () => {
    if (!containerRef.current) return
    const cardWidth = containerRef.current.firstChild
      ? (containerRef.current.firstChild as HTMLElement).clientWidth + 24
      : 0
    containerRef.current.scrollBy({ left: cardWidth, behavior: 'smooth' })
  }

  return (
    <div className="relative w-full max-w-[100%] mx-auto mt-6 overflow-visible">
      {/* Left arrow */}
      <button
        onClick={scrollLeft}
        className="absolute -left-20 top-1/2 -translate-y-1/2 z-10 bg-[var(--accent-3)] text-[var(--background)] rounded-full p-3 shadow hover:bg-[var(--accent-2)] transition"
      >
        <FaChevronLeft size={20} />
      </button>

      {/* Right arrow */}
      <button
        onClick={scrollRight}
        className="absolute -right-20 top-1/2 -translate-y-1/2 z-10 bg-[var(--accent-3)] text-[var(--background)] rounded-full p-3 shadow hover:bg-[var(--accent-2)] transition"
      >
        <FaChevronRight size={20} />
      </button>

      <div className="overflow-visible">
        <div
          ref={containerRef}
          className="flex gap-6 snap-x snap-mandatory overflow-x-auto scroll-smooth hide-scrollbar p-4"
        >
          {summaries.map((s, idx) => (
            <div
              key={idx}
              className="snap-start flex-shrink-0 w-80 md:w-96 bg-[var(--accent-1)] text-[var(--foreground)] rounded-2xl p-6 shadow-lg transition-transform transform-gpu duration-300 hover:scale-105 hover:z-20 relative"
            >
              <h3 className="text-xl font-bold text-[var(--accent-3)] mb-2">{s.date}</h3>
              <div className="space-y-1">
                <p>Revenue: ${s.revenue}</p>
                <p>Expenses: ${s.expenses}</p>
                <p>Total Clients: {s.total_clients}</p>
                <p>Returning Clients: {s.returning_clients}</p>
                <p>New Clients: {s.new_clients}</p>
                <p>Avg Ticket: ${s.avg_ticket.toFixed(2)}</p>
                <p>Top Service: {s.top_service}</p>
              </div>
            </div>
          ))}
        </div>
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
