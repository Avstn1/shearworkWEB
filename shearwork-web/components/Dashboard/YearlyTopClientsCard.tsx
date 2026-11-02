'use client'

import React, { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { EmptyState } from '@/components/ui/AppKit'

type Timeframe = 'year' | 'Q1' | 'Q2' | 'Q3' | 'Q4'

interface YearlyTopClientsCardProps {
  userId: string
  year: number
  timeframe: Timeframe
}

interface TopClient {
  client_id: string
  client_name: string
  total_spent: number
  num_visits: number
}

export default function YearlyTopClientsCard({
  userId,
  year,
  timeframe,
}: YearlyTopClientsCardProps) {
  const [clients, setClients] = useState<TopClient[]>([])
  const [loading, setLoading] = useState<boolean>(false)

  useEffect(() => {
    if (!userId || !year) return

    const fetchTopClients = async () => {
      try {
        setLoading(true)

        // Use API route to fetch top clients (handles large datasets properly)
        const res = await fetch(
          `/api/dashboard/yearly-top-clients?year=${year}&timeframe=${timeframe}&limit=5`
        )

        if (!res.ok) {
          throw new Error('Failed to fetch top clients')
        }

        const data = await res.json()
        
        setClients(data.clients || [])
      } catch (err) {
        console.error('Error fetching yearly/quarterly top clients:', err)
        setClients([])
      } finally {
        setLoading(false)
      }
    }

    fetchTopClients()
  }, [userId, year, timeframe])

  const titleSuffix =
    timeframe === 'year' ? `${year}` : `${timeframe} ${year}`

  return (
    <div className="top-clients-card flex min-h-[320px] max-h-[480px] flex-1 flex-col">
      <h2 className="panel-title mb-3">Top Clients ({titleSuffix})</h2>

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-gray-500">Loading…</div>
      ) : clients.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState icon={Users} title="No clients yet">
            No data available for {titleSuffix}
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
                <tr key={client.client_id ?? idx}>
                  <td className="tabular-nums text-gray-500">{idx + 1}</td>
                  <td className="max-w-[180px] truncate font-medium text-ivory">{client.client_name}</td>
                  <td className="text-right tabular-nums text-ivory">${client.total_spent.toFixed(2)}</td>
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
