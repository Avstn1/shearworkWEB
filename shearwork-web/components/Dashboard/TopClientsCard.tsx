'use client'

import React, { useEffect, useState } from 'react'

interface TopClientsCardProps {
  userId?: string
  selectedMonth?: string
  selectedYear?: number | null
}

interface TopClient {
  client_id: string
  client_name: string
  revenue: number
  tips: number
  total_spent: number
  num_visits: number
}

export default function TopClientsCard({ userId, selectedMonth, selectedYear }: TopClientsCardProps) {
  const [clients, setClients] = useState<TopClient[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId || !selectedMonth || !selectedYear) return

    const fetchTopClients = async () => {
      try {
        setLoading(true)
        setError(null)

        const params = new URLSearchParams({
          month: selectedMonth,
          year: String(selectedYear),
          limit: '5',
        })

        const res = await fetch(`/api/dashboard/top-clients?${params.toString()}`, {
          cache: 'no-store',
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || 'Failed to fetch top clients')
        }

        const data = await res.json()
        setClients(data.clients || [])
      } catch (err: any) {
        console.error('Error fetching top clients:', err)
        setError(err.message)
        setClients([])
      } finally {
        setLoading(false)
      }
    }

    fetchTopClients()
  }, [userId, selectedMonth, selectedYear])

  const formatCurrency = (amount: number) => 
    `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div
      className="top-clients-card flex-1 flex flex-col min-h-[320px] max-h-[480px]"
    >
      <h2 className="text-xl font-bold mb-3 flex items-center gap-2 text-white">
        🏆 Top Clients
      </h2>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-[#555]">
          Loading...
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center text-sm text-[#fbbf24] text-center">
          {error}
        </div>
      ) : clients.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-[#555] text-center">
          No data available for {selectedMonth} {selectedYear ?? ''}
        </div>
      ) : (
        <div className="overflow-y-auto flex-1">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0">
              <tr className="text-left border-b border-white/[0.06]">
                <th className="py-2 px-3 min-w-[30px] text-[#555] text-xs font-medium">#</th>
                <th className="py-2 px-3 min-w-[120px] text-[#555] text-xs font-medium">Client</th>
                <th className="py-2 px-3 min-w-[80px] text-[#555] text-xs font-medium">Total</th>
                <th className="py-2 px-3 min-w-[60px] text-[#555] text-xs font-medium">Visits</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client, idx) => (
                <tr
                  key={`${client.client_id}-${idx}`}
                  className={`border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors duration-150 ${
                    idx % 2 === 0 ? 'bg-white/[0.02]' : ''
                  }`}
                  style={{ height: '45px' }}
                >
                  <td className="py-2 px-3 font-medium text-white/40">{idx + 1}</td>
                  <td className="py-2 px-3 font-semibold truncate text-white">
                    {client.client_name}
                  </td>
                  <td className="py-2 px-3 font-semibold text-[#6ee7b7]">
                    {formatCurrency(client.total_spent)}
                  </td>
                  <td className="py-2 px-3 font-semibold text-[#a78bfa]">
                    {client.num_visits}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style jsx>{`
        @media (max-width: 768px) {
          .top-clients-card {
            min-height: auto;
            max-height: none;
            height: auto;
            width: 100%;
            overflow-y: visible;
          }

          table {
            display: block;
            overflow-x: auto;
            width: 100%;
            font-size: 0.75rem;
          }

          th,
          td {
            white-space: nowrap;
            padding: 0.25rem 0.5rem;
          }
        }
      `}</style>
    </div>
  )
}