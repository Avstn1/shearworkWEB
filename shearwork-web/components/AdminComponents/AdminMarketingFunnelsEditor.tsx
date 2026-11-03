'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'
import { Megaphone, Plus, Trash2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/AppKit'

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
    <section className="panel">
      <header className="panel-header">
        <div className="min-w-0">
          <h3 className="panel-title">Marketing funnels</h3>
          <p className="panel-subtitle">Client sources for {month}</p>
        </div>
        <button onClick={handleAdd} className="btn btn-glass btn-sm shrink-0">
          <Plus size={16} strokeWidth={1.75} />
          Add funnel
        </button>
      </header>

      {loading ? (
        <p className="panel-body text-sm text-muted">Loading funnels...</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={Megaphone} title="No funnel data yet">
          Nothing recorded for {month}. Start by adding a source.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-clean min-w-[560px]">
            <thead>
              <tr>
                <th>Source</th>
                <th className="w-24">New</th>
                <th className="w-28">Returning</th>
                <th className="w-24 text-right">Retention</th>
                <th className="w-32" />
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id}>
                  <td className="!py-2">
                    <input
                      className="field !h-8 !px-2 text-[13px]"
                      value={row.source}
                      onChange={e => setRows(prev => prev.map(r => r.id === row.id ? { ...r, source: e.target.value } : r))}
                      placeholder="Source name"
                    />
                  </td>
                  <td className="!py-2">
                    <input
                      className="field !h-8 !px-2 text-[13px] tabular-nums"
                      value={row.new_clients}
                      onChange={e => handleNumericChange(e, val => setRows(prev => prev.map(r => r.id === row.id ? { ...r, new_clients: val } : r)))}
                      placeholder="0"
                    />
                  </td>
                  <td className="!py-2">
                    <input
                      className="field !h-8 !px-2 text-[13px] tabular-nums"
                      value={row.returning_clients}
                      onChange={e => handleNumericChange(e, val => setRows(prev => prev.map(r => r.id === row.id ? { ...r, returning_clients: val } : r)))}
                      placeholder="0"
                    />
                  </td>
                  <td className="text-right tabular-nums">{row.retention}%</td>
                  <td className="!py-2">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => handleSave(row)}
                        disabled={savingId === row.id}
                        className="btn btn-primary btn-sm !h-8"
                      >
                        {savingId === row.id ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => handleDelete(row.id, row.isNew)}
                        className="btn btn-ghost btn-sm !h-8 !px-2 hover:!text-[#FF8F7D]"
                        aria-label="Delete funnel"
                      >
                        <Trash2 size={16} strokeWidth={1.75} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
