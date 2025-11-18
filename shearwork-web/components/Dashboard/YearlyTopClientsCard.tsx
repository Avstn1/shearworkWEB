'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'

interface YearlyTopClientsCardProps {
  userId: string
  year: number
}

interface TopClient {
  client_id: string
  client_name: string | null
  total_paid: number | null
  num_visits: number | null
}

export default function YearlyTopClientsCard({ userId, year }: YearlyTopClientsCardProps) {
  const [clients, setClients] = useState<TopClient[]>([])
  const [loading, setLoading] = useState<boolean>(false)

  useEffect(() => {
    if (!userId || !year) return

    const fetchTopClients = async () => {
      try {
        setLoading(true)

        const { data: topClients, error } = await supabase
          .from('yearly_top_clients')
          .select('client_id, client_name, total_paid, num_visits')
          .eq('user_id', userId)
          .eq('year', year)
          .order('total_paid', { ascending: false })

        if (error) throw error

        const filtered = (topClients as TopClient[]).filter(
          (f) =>
            f.client_name &&
            f.client_name !== 'Unknown' &&
            f.client_name !== 'Returning Client' &&
            !/walk/i.test(f.client_name)
        )

        setClients(filtered || [])
      } catch (err) {
        console.error('Error fetching yearly top clients:', err)
        setClients([])
      } finally {
        setLoading(false)
      }
    }

    fetchTopClients()
  }, [userId, year])

  return (
    <div
      className="top-clients-card rounded-lg shadow-md p-4 flex-1 border flex flex-col min-h-[320px] max-h-[480px]"
      style={{
        background: 'var(--card-topclients-bg)',
        borderColor: 'var(--card-revenue-border)',
        color: 'var(--foreground)',
      }}
    >
      <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
        👑 Top Clients (Year)
      </h2>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
          Loading...
        </div>
      ) : clients.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400 text-center">
          No data available for {year}
        </div>
      ) : (
        <div className="overflow-y-auto flex-1">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-[var(--card-topclients-bg)]">
              <tr className="text-left border-b border-[#444]">
                <th className="py-2 px-3 min-w-[30px]">#</th>
                <th className="py-2 px-3 min-w-[120px]">Client</th>
                <th className="py-2 px-3 min-w-[80px]">Service Totals</th>
                <th className="py-2 px-3 min-w-[60px]">Visits</th>
              </tr>
            </thead>
            <tbody>
              {clients.slice(0, 5).map((client, idx) => (
                <tr
                  key={client.client_id ?? idx}
                  className={`border-b border-[#444] hover:bg-[#2f2f2a] transition-colors duration-150 ${
                    idx % 2 === 0 ? 'bg-[#1f1f1a]' : ''
                  }`}
                  style={{ height: '45px' }}
                >
                  <td className="py-2 px-3 font-medium">{idx + 1}</td>
                  <td className="py-2 px-3 font-semibold truncate">
                    {client.client_name ?? 'N/A'}
                  </td>
                  <td className="py-2 px-3 font-semibold text-green-400">
                    ${client.total_paid?.toFixed(2) ?? '-'}
                  </td>
                  <td className="py-2 px-3 font-semibold text-yellow-400">
                    {client.num_visits ?? '-'}
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
