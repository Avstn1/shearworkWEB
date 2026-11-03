'use client'

import React, { useEffect, useState } from 'react'
import { Crown, Users } from 'lucide-react'
import { EmptyState, PanelHeading } from '@/components/ui/AppKit'

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
    <div className="top-clients-card flex min-h-[320px] max-h-[480px] flex-1 flex-col lg:h-full lg:max-h-none lg:min-h-0">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <PanelHeading icon={Crown} tone="sand">Top clients</PanelHeading>
        {selectedMonth && (
          <span className="text-xs text-gray-500">
            {selectedMonth} {selectedYear ?? ''}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-gray-500">Loading…</div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center text-center text-sm text-[#FF8F7D]">{error}</div>
      ) : clients.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState icon={Users} title="No clients yet">
            No data available for {selectedMonth} {selectedYear ?? ''}
          </EmptyState>
        </div>
      ) : (
        <div className="-mx-4 flex-1 overflow-y-auto sm:-mx-5">
          <table className="table-clean">
            <thead>
              <tr>
                <th className="w-10">#</th>
                <th>Client</th>
                <th className="text-right">Total</th>
                <th className="text-right">Visits</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client, idx) => (
                <tr key={`${client.client_id}-${idx}`}>
                  <td className="tabular-nums text-gray-500">{idx + 1}</td>
                  <td className="max-w-[180px] truncate font-medium text-ivory">{client.client_name}</td>
                  <td className="text-right tabular-nums text-ivory">{formatCurrency(client.total_spent)}</td>
                  <td className="text-right tabular-nums text-gray-400">{client.num_visits}</td>
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
        }
      `}</style>
    </div>
  )
}
