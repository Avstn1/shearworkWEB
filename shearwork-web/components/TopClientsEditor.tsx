'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'

interface TopClient {
  id?: string
  client_name: string
  total_paid: number | ''
  num_visits: number | ''
  notes: string
}

interface TopClientsEditorProps {
  barberId: string
  month: string
  year: number
}

// Numeric input handler
const handleNumericChange = (
  e: React.ChangeEvent<HTMLInputElement>,
  onChange: (val: number | '') => void
) => {
  const value = e.target.value
  if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
    onChange(value === '' ? '' : Number(value))
  }
}

export default function TopClientsEditor({ barberId, month, year }: TopClientsEditorProps) {
  const [clients, setClients] = useState<TopClient[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!barberId) return

    const fetchTopClients = async () => {
      setLoading(true)
      try {
        const { data: topClients, error } = await supabase
          .from('report_top_clients')
          .select('*')
          .eq('user_id', barberId)
          .eq('month', month)
          .eq('year', year)
          .order('total_paid', { ascending: false })

        if (error) throw error

        if (topClients) {
          setClients(
            topClients.map(c => ({
              ...c,
              num_visits: c.num_visits ?? '',
              total_paid: c.total_paid ?? '',
              notes: c.notes ?? '',
              client_name: c.client_name ?? '',
            }))
          )
        }
      } catch (err) {
        console.error('Error loading top clients:', err)
        toast.error('Failed to load top clients.')
      } finally {
        setLoading(false)
      }
    }

    fetchTopClients()
  }, [barberId, month, year])

  const handleAddClient = () => {
    setClients(prev => [
      ...prev,
      { client_name: '', total_paid: '', num_visits: '', notes: '' },
    ])
  }

  const handleRemoveClient = async (index: number) => {
    const clientToRemove = clients[index]

    if (clientToRemove.id) {
      try {
        const { error } = await supabase
          .from('report_top_clients')
          .delete()
          .eq('id', clientToRemove.id)

        if (error) throw error
        toast.success(`Removed client "${clientToRemove.client_name}"`)
      } catch (err) {
        console.error('Error deleting client:', err)
        toast.error('Failed to delete client.')
        return
      }
    }

    setClients(prev => prev.filter((_, i) => i !== index))
  }

  const handleChange = (index: number, field: keyof TopClient, value: any) => {
    setClients(prev => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const upsertData = clients.map(c => ({
        user_id: barberId,
        month,
        year,
        client_name: c.client_name.trim(),
        total_paid: c.total_paid === '' ? 0 : c.total_paid,
        num_visits: c.num_visits === '' ? 0 : c.num_visits,
        notes: c.notes.trim(),
      }))

      const { error } = await supabase
        .from('report_top_clients')
        .upsert(upsertData, { onConflict: 'user_id,month,year,client_name' })

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

  return (
    <div className="bg-[var(--accent-2)]/20 border border-[var(--accent-2)]/30 rounded-xl p-4 shadow-sm">
      <h3 className="text-base font-semibold mb-3">Top Clients</h3>

      <div className="flex flex-col gap-4">
        {clients.map((client, idx) => (
          <div
            key={client.id || idx}
            className="grid grid-cols-12 gap-2 items-center bg-[var(--bg-light)]/10 rounded-lg p-2 border border-[var(--accent-3)]/20"
          >
            <div className="col-span-1 flex flex-col">
              <label className="text-[10px] text-gray-400 mb-0.5">#</label>
              <div className="text-center text-xs font-bold text-white mt-1">{idx + 1}</div>
            </div>

            <div className="col-span-3 flex flex-col">
              <label className="text-[10px] text-gray-400 mb-0.5">Client Name</label>
              <input
                type="text"
                className="bg-[#2f3a2d] border border-[#55694b] rounded-md px-2 py-1 text-xs text-white"
                value={client.client_name}
                onChange={e => handleChange(idx, 'client_name', e.target.value)}
              />
            </div>

            <div className="col-span-2 flex flex-col">
              <label className="text-[10px] text-gray-400 mb-0.5">Total Paid ($)</label>
              <input
                type="text"
                inputMode="decimal"
                className="bg-[#2f3a2d] border border-[#55694b] rounded-md px-2 py-1 text-xs text-white"
                value={client.total_paid}
                onChange={e => handleNumericChange(e, val => handleChange(idx, 'total_paid', val))}
              />
            </div>

            <div className="col-span-2 flex flex-col">
              <label className="text-[10px] text-gray-400 mb-0.5"># of Visits</label>
              <input
                type="text"
                inputMode="decimal"
                className="bg-[#2f3a2d] border border-[#55694b] rounded-md px-2 py-1 text-xs text-white"
                value={client.num_visits}
                onChange={e => handleNumericChange(e, val => handleChange(idx, 'num_visits', val))}
              />
            </div>

            <div className="col-span-3 flex flex-col">
              <label className="text-[10px] text-gray-400 mb-0.5">Notes</label>
              <input
                type="text"
                className="bg-[#2f3a2d] border border-[#55694b] rounded-md px-2 py-1 text-xs text-white"
                value={client.notes}
                onChange={e => handleChange(idx, 'notes', e.target.value)}
              />
            </div>

            <button
              onClick={() => handleRemoveClient(idx)}
              className="col-span-1 bg-red-600 hover:bg-red-700 text-white rounded px-2 py-1 text-xs mt-4"
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
