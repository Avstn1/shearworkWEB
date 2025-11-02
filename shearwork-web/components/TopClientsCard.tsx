'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'

interface TopClientsCardProps {
  userId?: string
  selectedMonth?: string
}

interface TopClient {
  id: string
  rank: number | null
  client_name: string | null
  total_paid: number | null
  num_visits: number | null
  notes: string | null
}

export default function TopClientsCard({ userId, selectedMonth }: TopClientsCardProps) {
  const [clients, setClients] = useState<TopClient[]>([])
  const [loading, setLoading] = useState<boolean>(false)

  useEffect(() => {
    if (!userId || !selectedMonth) return

    const fetchTopClients = async () => {
      try {
        setLoading(true)
        const year = new Date().getFullYear()

        // Fetch the monthly report
        const { data: report } = await supabase
          .from('reports')
          .select('id')
          .eq('user_id', userId)
          .eq('type', 'monthly')
          .eq('month', selectedMonth)
          .eq('year', year)
          .maybeSingle()

        if (!report?.id) {
          setClients([])
          return
        }

        // Fetch top clients including num_visits
        const { data: topClients } = await supabase
          .from('report_top_clients')
          .select('id, rank, client_name, total_paid, num_visits, notes')
          .eq('report_id', report.id)
          .order('rank', { ascending: true })

        setClients(topClients || [])
      } catch (err) {
        console.error('Error fetching top clients:', err)
        setClients([])
      } finally {
        setLoading(false)
      }
    }

    fetchTopClients()
  }, [userId, selectedMonth])

  return (
    <div
      className="top-clients-card rounded-lg shadow-md p-4 flex-1 min-h-[250px] border"
      style={{
        background: 'var(--card-topclients-bg)',
        borderColor: 'var(--card-revenue-border)',
        color: 'var(--foreground)',
      }}
    >
      <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
        🏆 Top Clients
      </h2>

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : clients.length === 0 ? (
        <p className="text-sm text-gray-400">No data available for {selectedMonth}.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
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
                >
                  <td className="py-2 px-3 font-medium">{client.rank ?? '-'}</td>
                  <td className="py-2 px-3 font-semibold">{client.client_name ?? 'N/A'}</td>
                  <td className="py-2 px-3 font-semibold text-green-400">
                    ${client.total_paid?.toFixed(2) ?? '-'}
                  </td>
                  <td className="py-2 px-3 font-semibold text-yellow-400">
                    {client.num_visits ?? '-'}
                  </td>
                  <td className="py-2 px-3 italic text-gray-300">{client.notes ?? '-'}</td>
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
          th, td {
            padding: 0.25rem 0.5rem;
          }
        }
      `}</style>
    </div>
  )
}
