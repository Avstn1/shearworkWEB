'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'
import { Plus, Scissors, Trash2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/AppKit'

interface Props {
  barberId: string
  month: string
}

interface ServiceRow {
  id?: number | string
  service_name: string
  bookings: number | ''
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

export default function AdminServiceBreakdownEditor({ barberId, month }: Props) {
  const [rows, setRows] = useState<ServiceRow[]>([])
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<number | string | null>(null)

  useEffect(() => {
    if (!barberId) return
    fetchData()
  }, [barberId, month])

  const fetchData = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('service_bookings')
      .select('id, service_name, bookings')
      .eq('user_id', barberId)
      .eq('report_month', month)
      .eq('report_year', new Date().getFullYear())

    if (error) {
      toast.error('Failed to load data.')
      setRows([])
    } else {
      setRows(data || [])
    }
    setLoading(false)
  }

  const handleSave = async (row: ServiceRow) => {
    if (!barberId) return toast.error('Missing barber ID.')
    setSavingId(row.id ?? null)

    const payload = {
      user_id: barberId,
      service_name: row.service_name,
      bookings: row.bookings || 0,
      report_month: month,
      report_year: new Date().getFullYear(),
      created_at: new Date().toISOString(),
    }

    if (row.isNew) {
      const { data, error } = await supabase
        .from('service_bookings')
        .insert([payload])
        .select()
        .maybeSingle()

      setSavingId(null)
      if (error) toast.error('Failed to save new service.')
      else if (data) {
        toast.success('Service saved!')
        setRows(prev =>
          prev.map(r => (r.id === row.id ? { ...data, isNew: false } : r))
        )
      }
      return
    }

    const { error } = await supabase
      .from('service_bookings')
      .update({ service_name: row.service_name, bookings: row.bookings || 0 })
      .eq('id', row.id)

    setSavingId(null)
    if (error) toast.error('Update failed.')
    else toast.success('Service updated!')
  }

  const handleDelete = async (id?: number | string, isNew?: boolean) => {
    if (!id) return
    if (isNew) {
      setRows(prev => prev.filter(r => r.id !== id))
      return
    }

    if (!confirm('Delete this service entry?')) return
    const { error } = await supabase
      .from('service_bookings')
      .delete()
      .eq('id', id)

    if (error) toast.error('Delete failed.')
    else {
      toast.success('Deleted.')
      setRows(prev => prev.filter(r => r.id !== id))
    }
  }

  const handleAdd = () => {
    const tempId = `temp-${Math.random().toString(36).substring(2, 9)}`
    const newRow: ServiceRow = {
      id: tempId,
      service_name: '',
      bookings: '',
      isNew: true,
    }
    setRows(prev => [...prev, newRow])
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <div className="min-w-0">
          <h3 className="panel-title">Service breakdown</h3>
          <p className="panel-subtitle">Bookings per service for {month}</p>
        </div>
        <button onClick={handleAdd} className="btn btn-glass btn-sm shrink-0">
          <Plus size={16} strokeWidth={1.75} />
          Add service
        </button>
      </header>

      <div className="panel-body">
        {loading ? (
          <p className="text-sm text-muted">Loading services...</p>
        ) : rows.length === 0 ? (
          <EmptyState icon={Scissors} title="No service data yet">
            Nothing recorded for {month}. Start by adding a service.
          </EmptyState>
        ) : (
          <div className="space-y-2">
            {rows.map(row => (
              <div key={row.id} className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={row.service_name}
                  onChange={e => setRows(prev =>
                    prev.map(r => r.id === row.id ? { ...r, service_name: e.target.value } : r)
                  )}
                  placeholder="Service name"
                  className="field !w-48 flex-1 sm:flex-none"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={row.bookings}
                  onChange={e => handleNumericChange(e, val =>
                    setRows(prev => prev.map(r => r.id === row.id ? { ...r, bookings: val } : r))
                  )}
                  placeholder="Bookings"
                  className="field !w-28 tabular-nums"
                />
                <button
                  onClick={() => handleSave(row)}
                  disabled={savingId === row.id}
                  className="btn btn-primary btn-sm"
                >
                  {savingId === row.id ? 'Saving...' : row.isNew ? 'Save new' : 'Save'}
                </button>
                <button
                  onClick={() => handleDelete(row.id, row.isNew)}
                  className="btn btn-ghost btn-sm hover:!text-[#FF8F7D]"
                  aria-label="Delete service"
                >
                  <Trash2 size={16} strokeWidth={1.75} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
