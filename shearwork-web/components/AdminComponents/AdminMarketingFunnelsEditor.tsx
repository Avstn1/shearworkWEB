'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'

interface Props {
  barberId: string
  month: string
}

interface FunnelRow {
  id?: number | string
  source: string
  new_clients: number | ''
  returning_clients: number | ''
  retention: number
  isNew?: boolean
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

export default function AdminMarketingFunnelsEditor({ barberId, month }: Props) {
  const [rows, setRows] = useState<FunnelRow[]>([])
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<number | string | null>(null)

  useEffect(() => {
    if (!barberId) return
    fetchFunnels()
  }, [barberId, month])

  const fetchFunnels = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('marketing_funnels')
      .select('*')
      .eq('user_id', barberId)
      .eq('report_month', month)
      .eq('report_year', new Date().getFullYear())

    if (error) {
      console.error('Failed to load funnels:', error)
      toast.error('Failed to load funnels.')
      setRows([])
    } else {
      setRows(data || [])
    }
    setLoading(false)
  }

  const handleSave = async (row: FunnelRow) => {
    if (!barberId) return toast.error('Missing barber ID.')
    setSavingId(row.id ?? null)

    const newClients = row.new_clients || 0
    const returningClients = row.returning_clients || 0
    const retention = newClients > 0 ? Math.round((returningClients / newClients) * 100) : 0

    if (row.isNew) {
      const payload = {
        user_id: barberId,
        source: row.source,
        new_clients: row.new_clients || 0,
        returning_clients: row.returning_clients || 0,
        retention,
        report_month: month,
        report_year: new Date().getFullYear(),
        created_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('marketing_funnels')
        .insert([payload])
        .select()
        .maybeSingle()

      setSavingId(null)
      if (error) {
        console.error('Insert failed:', error)
        toast.error('Failed to save new funnel.')
      } else if (data) {
        toast.success('Funnel saved!')
        setRows(prev =>
          prev.map(r => (r.id === row.id ? { ...data, isNew: false } : r))
        )
      }
      return
    }

    const { error } = await supabase
      .from('marketing_funnels')
      .update({
        source: row.source,
        new_clients: row.new_clients || 0,
        returning_clients: row.returning_clients || 0,
        retention,
      })
      .eq('id', row.id)

    setSavingId(null)
    if (error) {
      console.error('Update error:', error)
      toast.error('Update failed.')
    } else {
      toast.success('Funnel updated!')
    }
  }

  const handleDelete = async (id?: number | string, isNew?: boolean) => {
    if (!id) return
    if (isNew) {
      setRows(prev => prev.filter(r => r.id !== id))
      return
    }

    if (!confirm('Delete this funnel entry?')) return
    const { error } = await supabase
      .from('marketing_funnels')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Delete failed:', error)
      toast.error('Delete failed.')
    } else {
      toast.success('Deleted.')
      setRows(prev => prev.filter(r => r.id !== id))
    }
  }

  const handleAdd = () => {
    const tempId = `temp-${Math.random().toString(36).substring(2, 9)}`
    const newRow: FunnelRow = {
      id: tempId,
      source: '',
      new_clients: '',
      returning_clients: '',
      retention: 0,
      isNew: true,
    }
    setRows(prev => [...prev, newRow])
  }

  return (
    <div className="bg-[#1f1f1a] p-4 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-[#E8EDC7] font-semibold text-lg">📣 Marketing Funnels Editor</h3>
        <button
          onClick={handleAdd}
          className="px-3 py-1 bg-[#445539] rounded hover:bg-[#4d6544] text-white"
        >
          Add Funnel
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading funnels...</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-400">No funnel data yet for {month}. You can start by adding one.</p>
      ) : (
        <div className="space-y-3">
          <div className="hidden md:flex text-sm text-gray-400 px-2">
            <div className="flex-[4]">Source</div>
            <div className="w-16 text-center">New</div>
            <div className="w-20 text-center">Returning</div>
            <div className="w-20 text-center">Retention</div>
            <div className="w-32"></div>
          </div>

          {rows.map(row => (
            <div key={row.id} className="flex flex-col md:flex-row md:items-center gap-2 bg-[#111] p-3 rounded">
              <input
                className="p-2 rounded bg-[#2b2b2b] text-white flex-[4] min-w-2"
                value={row.source}
                onChange={e => setRows(prev => prev.map(r => r.id === row.id ? { ...r, source: e.target.value } : r))}
                placeholder="Source name"
              />
              <input
                className="p-2 rounded bg-[#2b2b2b] text-white w-16 text-center"
                value={row.new_clients}
                onChange={e => handleNumericChange(e, val => setRows(prev => prev.map(r => r.id === row.id ? { ...r, new_clients: val } : r)))}
                placeholder="0"
              />
              <input
                className="p-2 rounded bg-[#2b2b2b] text-white w-20 text-center"
                value={row.returning_clients}
                onChange={e => handleNumericChange(e, val => setRows(prev => prev.map(r => r.id === row.id ? { ...r, returning_clients: val } : r)))}
                placeholder="0"
              />
              <div className="w-20 text-center">{row.retention}%</div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSave(row)}
                  disabled={savingId === row.id}
                  className="px-2 py-1 bg-[#445539] rounded hover:bg-[#4d6544] text-white text-xs"
                >
                  {savingId === row.id ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => handleDelete(row.id, row.isNew)}
                  className="px-2 py-1 bg-red-600 rounded hover:bg-red-700 text-white text-xs"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
