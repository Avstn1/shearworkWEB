'use client'

import React from 'react'
import { format } from 'date-fns'

interface SummaryCardProps {
  summary: {
    id: string
    user_id: string
    date: string
    revenue: number
    expenses: number
    total_clients: number
    returning_clients: number
    new_clients: number
    avg_ticket: number
    top_service: string
  }
}

export default function SummaryCard({ summary }: SummaryCardProps) {
  const formattedDate = summary.date ? format(new Date(summary.date), 'PPP') : 'Unknown Date'

  return (
    <div
      className="
        bg-gray-900
        rounded-2xl
        p-6
        shadow-lg
        border
        border-gray-700
        hover:border-teal-500
        hover:shadow-teal-500/20
        transition-all
        duration-200
      "
    >
      <h3 className="text-2xl font-semibold text-teal-400 mb-2">
        {formattedDate}
      </h3>

      <div className="space-y-2 text-gray-300 text-sm">
        <p><span className="text-gray-400">Revenue:</span> ${summary.revenue.toFixed(2)}</p>
        <p><span className="text-gray-400">Expenses:</span> ${summary.expenses.toFixed(2)}</p>
        <p><span className="text-gray-400">Total Clients:</span> {summary.total_clients}</p>
        <p><span className="text-gray-400">Returning:</span> {summary.returning_clients}</p>
        <p><span className="text-gray-400">New:</span> {summary.new_clients}</p>
        <p><span className="text-gray-400">Avg Ticket:</span> ${summary.avg_ticket.toFixed(2)}</p>
        <p><span className="text-gray-400">Top Service:</span> {summary.top_service || 'N/A'}</p>
      </div>
    </div>
  )
}
