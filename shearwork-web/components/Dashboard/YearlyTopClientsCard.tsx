'use client'

import React, { useEffect, useState } from 'react'

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
    <div
      className="top-clients-card flex-1 flex flex-col min-h-[320px] max-h-[480px]"
    >
      <h2 className="text-xl font-bold mb-3 flex items-center gap-2 text-white">
        👑 Top Clients ({titleSuffix})
      </h2>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-[#555]">
          Loading...
        </div>
      ) : clients.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-[#555] text-center">
          No data available for {titleSuffix}
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
                  key={client.client_id ?? idx}
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
                    ${client.total_spent.toFixed(2)}
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