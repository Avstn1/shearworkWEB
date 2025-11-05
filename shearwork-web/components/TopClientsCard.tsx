'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'

interface TopClientsCardProps {
  userId?: string
  selectedMonth?: string
  selectedYear?: number | null // allow null
}

interface TopClient {
  id: string
  client_name: string | null
  total_paid: number | null
  num_visits: number | null
  notes: string | null
}

export default function TopClientsCard({ userId, selectedMonth, selectedYear }: TopClientsCardProps) {
  const [clients, setClients] = useState<TopClient[]>([])
  const [loading, setLoading] = useState<boolean>(false)

  useEffect(() => {
    if (!userId || !selectedMonth || !selectedYear) return

    const fetchTopClients = async () => {
      try {
        setLoading(true)

        const year = selectedYear ?? new Date().getFullYear() // fallback if needed

        const { data: topClients, error } = await supabase
          .from('report_top_clients')
          .select('id, client_name, total_paid, num_visits, notes')
          .eq('user_id', userId)
          .eq('month', selectedMonth)
          .eq('year', year)
          .order('total_paid', { ascending: false })

        if (error) throw error

        setClients(topClients || [])
      } catch (err) {
        console.error('Error fetching top clients:', err)
        setClients([])
      } finally {
        setLoading(false)
      }
    }

    fetchTopClients()
  }, [userId ?? '', selectedMonth ?? '', selectedYear ?? 0])

  return (
    <div
      className="top-clients-card rounded-lg shadow-md p-4 flex-1 border flex flex-col"
      style={{
        background: 'var(--card-topclients-bg)',
        borderColor: 'var(--card-revenue-border)',
        color: 'var(--foreground)',
        height: '370px',
      }}
    >
      <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
        🏆 Top Clients
      </h2>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
          Loading...
        </div>
      ) : clients.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400 text-center">
          No data available for {selectedMonth} {selectedYear ?? ''}
        </div>
      ) : (
        <div className="overflow-y-auto flex-1">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-[var(--card-topclients-bg)]">
              <tr className="text-left border-b border-[#444]">
                <th className="py-2 px-3 min-w-[30px]">#</th>
                <th className="py-2 px-3 min-w-[120px]">Client</th>
                <th className="py-2 px-3 min-w-[80px]">Total Paid</th>
                <th className="py-2 px-3 min-w-[60px]">Visits</th>
                <th className="py-2 px-3 min-w-[100px]">Notes</th>
              </tr>
            </thead>
            <tbody>
              {clients.slice(0, 5).map((client, idx) => (
                <tr
                  key={client.id}
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
                  <td className="py-2 px-3 italic text-gray-300 truncate">
                    {client.notes ?? '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style jsx>{`
        @media (max-width: 768px) {
          table {
            font-size: 0.75rem;
          }
          th,
          td {
            padding: 0.25rem 0.5rem;
          }
        }
      `}</style>
    </div>
  )
}
