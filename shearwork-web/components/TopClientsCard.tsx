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

        const { data: report, error: reportError } = await supabase
          .from('reports')
          .select('id')
          .eq('user_id', userId)
          .eq('type', 'monthly')
          .eq('month', selectedMonth)
          .eq('year', year)
          .maybeSingle()

        if (reportError) {
          console.warn('Report lookup error (non-fatal):', reportError)
          setClients([])
          return
        }

        if (!report?.id) {
          setClients([])
          return
        }

        const { data: topClients, error: topClientsError } = await supabase
          .from('report_top_clients')
          .select('id, rank, client_name, total_paid, notes')
          .eq('report_id', report.id)
          .order('rank', { ascending: true })

        if (topClientsError) {
          console.warn('Top clients fetch error (non-fatal):', topClientsError)
          setClients([])
          return
        }

        setClients(topClients || [])
      } catch (err) {
        console.error('Unexpected error fetching top clients:', err)
        setClients([])
      } finally {
        setLoading(false)
      }
    }

    fetchTopClients()
  }, [userId, selectedMonth])

  return (
    <div
      className="top-clients-card rounded-lg shadow-md p-6 flex-1 min-h-[250px] text-[#c4d2b8] border"
      style={{
        background: 'var(--card-topclients-bg)',
        borderColor: 'var(--card-revenue-border)',
      }}
    >
      <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
        🏆 Top Clients
      </h2>

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : clients.length === 0 ? (
        <p className="text-sm text-gray-400">No data available for {selectedMonth}.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b border-[#333]">
              <th className="py-1">#</th>
              <th className="py-1">Client</th>
              <th className="py-1">Total Paid</th>
              <th className="py-1">Notes</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id} className="border-b border-[#333]">
                <td className="py-1">{client.rank ?? '-'}</td>
                <td className="py-1">{client.client_name ?? 'N/A'}</td>
                <td className="py-1">${client.total_paid?.toFixed(2) ?? '-'}</td>
                <td className="py-1">{client.notes ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
