'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'

interface TopClient {
  id?: string
  rank: number
  client_name: string
  total_paid: number
  notes: string
}

interface TopClientsEditorProps {
  barberId: string
  month: string
  year: number
}

export default function TopClientsEditor({ barberId, month, year }: TopClientsEditorProps) {
  const [clients, setClients] = useState<TopClient[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reportId, setReportId] = useState<string | null>(null)
  const [monthlyReportExists, setMonthlyReportExists] = useState<boolean>(false)

  useEffect(() => {
    if (!barberId) return

    const fetchReportAndClients = async () => {
      setLoading(true)
      try {
        // Fetch the monthly report
        const { data: reports, error: reportError } = await supabase
          .from('reports')
          .select('*')
          .eq('user_id', barberId)
          .eq('type', 'monthly')
          .eq('month', month)
          .eq('year', year)
          .limit(1)

        if (reportError) throw reportError

        const exists = Array.isArray(reports) && reports.length > 0
        setMonthlyReportExists(exists)
        if (!exists) return

        const report = reports![0]
        setReportId(report.id)

        // Fetch top clients
        const { data: topClients, error: topClientsError } = await supabase
          .from('report_top_clients')
          .select('*')
          .eq('report_id', report.id)
          .order('rank', { ascending: true })

        if (topClientsError && topClientsError.code !== 'PGRST116') throw topClientsError
        if (topClients) setClients(topClients)
      } catch (err) {
        console.error('Error loading top clients:', err)
        toast.error('Failed to load top clients.')
      } finally {
        setLoading(false)
      }
    }

    fetchReportAndClients()
  }, [barberId, month, year])

  const handleAddClient = () => {
    setClients(prev => [...prev, { rank: prev.length + 1, client_name: '', total_paid: 0, notes: '' }])
  }

  const handleRemoveClient = (index: number) => {
    setClients(prev => prev.filter((_, i) => i !== index))
  }

  const handleChange = (index: number, field: keyof TopClient, value: any) => {
    setClients(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c))
  }

  const handleSave = async () => {
    if (!reportId) {
      console.log('No report selected. Variables:', { reportId, barberId, month, year, clients })
      return toast.error('No report selected for saving.')
    }

    console.log('Saving top clients. Variables:', {
      reportId,
      barberId,
      month,
      year,
      clients,
    })

    setSaving(true)

    try {
      const { error } = await supabase
        .from('report_top_clients')
        .upsert(clients.map(c => ({
          ...(c.id ? { id: c.id } : {}), // only include id if it exists
          report_id: reportId,
          rank: c.rank,
          client_name: c.client_name,
          total_paid: c.total_paid,
          notes: c.notes,
        })))

      if (error) throw error
      toast.success('Top clients saved!')
    } catch (err) {
      console.error('Error saving top clients:', err)
      toast.error('Failed to save top clients.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p>Loading top clients...</p>
  if (!monthlyReportExists) return null

  return (
    <div className="bg-[var(--accent-2)]/20 border border-[var(--accent-2)]/30 rounded-xl p-4 shadow-sm">
      <h3 className="text-base font-semibold mb-3">Top Clients</h3>

      <div className="flex flex-col gap-3">
        {clients.map((client, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2 items-center">
            <input
              type="number"
              placeholder="Rank"
              className="col-span-1 bg-[#2f3a2d] border border-[#55694b] rounded-md px-2 py-1 text-xs text-white"
              value={client.rank}
              onChange={e => handleChange(idx, 'rank', Number(e.target.value))}
            />
            <input
              type="text"
              placeholder="Client Name"
              className="col-span-4 bg-[#2f3a2d] border border-[#55694b] rounded-md px-2 py-1 text-xs text-white"
              value={client.client_name}
              onChange={e => handleChange(idx, 'client_name', e.target.value)}
            />
            <input
              type="number"
              placeholder="Total Paid"
              className="col-span-2 bg-[#2f3a2d] border border-[#55694b] rounded-md px-2 py-1 text-xs text-white"
              value={client.total_paid}
              onChange={e => handleChange(idx, 'total_paid', Number(e.target.value))}
            />
            <input
              type="text"
              placeholder="Notes"
              className="col-span-4 bg-[#2f3a2d] border border-[#55694b] rounded-md px-2 py-1 text-xs text-white"
              value={client.notes}
              onChange={e => handleChange(idx, 'notes', e.target.value)}
            />
            <button
              onClick={() => handleRemoveClient(idx)}
              className="col-span-1 bg-red-600 hover:bg-red-700 text-white rounded px-2 py-1 text-xs"
            >
              ✕
            </button>
          </div>
        ))}

        <button
          onClick={handleAddClient}
          className="bg-[var(--accent-3)] hover:bg-[var(--accent-4)] text-[var(--text-bright)] rounded-md px-4 py-2 text-xs font-semibold transition-all shadow-sm"
        >
          + Add Client
        </button>

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-3 bg-[var(--accent-3)] hover:bg-[var(--accent-4)] text-[var(--text-bright)] rounded-md px-4 py-2 text-xs font-semibold transition-all shadow-sm"
        >
          {saving ? 'Saving...' : 'Save Top Clients'}
        </button>
      </div>
    </div>
  )
}
