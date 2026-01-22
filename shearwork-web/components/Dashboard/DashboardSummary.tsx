'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { format } from 'date-fns'
import { useAuth } from '@/contexts/AuthContext'

interface SummaryData {
  date: string
  revenue: number
  expenses: number
  total_clients: number
  returning_clients: number
  new_clients: number
  avg_ticket: number
}

export default function DashboardSummary() {
  const [summary, setSummary] = useState<SummaryData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  useEffect(() => {
    const fetchSummary = async () => {
      if (!user?.id) {
        setSummary([])
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('barber_summary')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false })

        if (error) throw error

        setSummary(data || [])
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchSummary()
  }, [user?.id])

  if (loading) return <p className="text-gray-400">Loading summary...</p>
  if (error) return <p className="text-red-400 bg-gray-800 p-2 rounded">{error}</p>

  return (
    <div className="bg-gray-800 rounded-xl p-6 mb-10 shadow-lg text-gray-100">
      <h2 className="text-3xl font-semibold mb-6 text-teal-300">Performance Summary</h2>
      {summary.length === 0 ? (
        <p className="text-gray-400 text-center">No summary data found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-700 rounded-lg overflow-hidden">
            <thead className="bg-gray-700 text-teal-300">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-right">Revenue ($)</th>
                <th className="px-4 py-2 text-right">Expenses ($)</th>
                <th className="px-4 py-2 text-right">Clients</th>
                <th className="px-4 py-2 text-right">Returning</th>
                <th className="px-4 py-2 text-right">New</th>
                <th className="px-4 py-2 text-right">Avg Ticket ($)</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row) => (
                <tr key={row.date} className="border-t border-gray-700 hover:bg-gray-750 transition">
                  <td className="px-4 py-2">{format(new Date(row.date), 'd MMM yyyy')}</td>
                  <td className="px-4 py-2 text-right">{row.revenue.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right">{row.expenses.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right">{row.total_clients}</td>
                  <td className="px-4 py-2 text-right">{row.returning_clients}</td>
                  <td className="px-4 py-2 text-right">{row.new_clients}</td>
                  <td className="px-4 py-2 text-right">{row.avg_ticket.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
