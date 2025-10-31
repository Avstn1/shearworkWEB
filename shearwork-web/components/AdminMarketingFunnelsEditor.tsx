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
  new_clients: number
  returning_clients: number
  retention: number
  isNew?: boolean
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

    const retention =
      row.new_clients + row.returning_clients > 0
        ? Math.round((row.returning_clients / (row.new_clients + row.returning_clients)) * 100)
        : 0

    if (row.isNew) {
      const payload = {
        user_id: barberId,
        source: row.source,
        new_clients: row.new_clients,
        returning_clients: row.returning_clients,
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
        new_clients: row.new_clients,
        returning_clients: row.returning_clients,
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
      new_clients: 0,
      returning_clients: 0,
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
                placeholder="Source (e.g., Instagram, Referral, Ads)"
              />

              <div className="flex flex-col w-full md:w-16 max-w-14">
                <label className="text-xs text-gray-400 md:hidden mb-1">New</label>
                <input
                  className="p-2 rounded bg-[#2b2b2b] text-white text-center"
                  type="number"
                  value={row.new_clients}
                  onChange={e => setRows(prev => prev.map(r => r.id === row.id ? { ...r, new_clients: Number(e.target.value) } : r))}
                  placeholder="New"
                />
              </div>

              <div className="flex flex-col w-full md:w-20 max-w-14">
                <label className="text-xs text-gray-400 md:hidden mb-1">Returning</label>
                <input
                  className="p-2 rounded bg-[#2b2b2b] text-white text-center"
                  type="number"
                  value={row.returning_clients}
                  onChange={e => setRows(prev => prev.map(r => r.id === row.id ? { ...r, returning_clients: Number(e.target.value) } : r))}
                  placeholder="Returning"
                />
              </div>

              <div className="text-gray-400 text-center md:w-20 md:block max-w-10">
                <label className="text-xs text-gray-400 md:hidden block mb-1">Retention %</label>
                <div className="p-2 bg-[#2b2b2b] rounded">{row.retention ? `${row.retention}%` : '-'}</div>
              </div>

              <div className="flex gap-2 justify-end w-full md:w-32 mt-2 md:mt-0">
                <button
                  onClick={() => handleSave(row)}
                  disabled={savingId === row.id}
                  className="px-3 py-1 bg-[#445539] rounded hover:bg-[#4d6544] text-white text-sm"
                >
                  {savingId === row.id ? 'Saving...' : row.isNew ? 'Save New' : 'Save'}
                </button>
                <button
                  onClick={() => handleDelete(row.id, row.isNew)}
                  className="px-3 py-1 bg-[#7b2b2b] rounded hover:bg-[#8b3939] text-white text-sm"
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
