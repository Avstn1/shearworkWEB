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

  if (loading) return <p className="text-sm text-gray-500">Loading summary…</p>
  if (error) return <p className="badge badge-danger">{error}</p>

  return (
    <section className="panel mb-10">
      <header className="panel-header">
        <h2 className="panel-title">Performance Summary</h2>
      </header>
      {summary.length === 0 ? (
        <div className="empty-state">
          <strong>No summary data found.</strong>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-clean">
            <thead>
              <tr>
                <th>Date</th>
                <th className="text-right">Revenue ($)</th>
                <th className="text-right">Expenses ($)</th>
                <th className="text-right">Clients</th>
                <th className="text-right">Returning</th>
                <th className="text-right">New</th>
                <th className="text-right">Avg Ticket ($)</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {summary.map((row) => (
                <tr key={row.date}>
                  <td>{format(new Date(row.date), 'd MMM yyyy')}</td>
                  <td className="text-right">{row.revenue.toFixed(2)}</td>
                  <td className="text-right">{row.expenses.toFixed(2)}</td>
                  <td className="text-right">{row.total_clients}</td>
                  <td className="text-right">{row.returning_clients}</td>
                  <td className="text-right">{row.new_clients}</td>
                  <td className="text-right">{row.avg_ticket.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
