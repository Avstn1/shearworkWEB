'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'

interface TopClient {
  id?: string
  client_name: string
  email: string
  total_paid: number | ''
  num_visits: number | ''
  notes: string
}

interface TopClientsEditorProps {
  barberId: string
  month: string
  year: number
}

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
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [newClient, setNewClient] = useState<TopClient>({
    client_name: '',
    email: '',
    total_paid: '',
    num_visits: '',
    notes: '',
  })

  const clientsPerPage = 5

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
              email: c.email ?? '',
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

  const handleAddClient = () => setShowModal(true)

  const handleSaveNewClient = () => {
    if (!newClient.client_name.trim() || !newClient.email.trim()) {
      toast.error('Name and email are required.')
      return
    }

    setClients(prev => [...prev, newClient])
    setNewClient({ client_name: '', email: '', total_paid: '', num_visits: '', notes: '' })
    setShowModal(false)
    toast.success('Client added!')
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
      const upsertData = clients
        .filter(c => c.client_name.trim() && c.email.trim())
        .map(c => ({
          user_id: barberId,
          month,
          year,
          client_name: c.client_name.trim(),
          email: c.email.trim(),
          total_paid: c.total_paid === '' ? 0 : c.total_paid,
          num_visits: c.num_visits === '' ? 0 : c.num_visits,
          notes: c.notes.trim(),
        }))

      const { error } = await supabase
        .from('report_top_clients')
        .upsert(upsertData, { onConflict: 'user_id,month,year,email' })

      if (error) throw error
      toast.success('Top clients saved!')
    } catch (err: any) {
      console.error('Error saving top clients:', err.message)
      toast.error('Failed to save top clients.')
    } finally {
      setSaving(false)
    }
  }

  const totalPages = Math.ceil(clients.length / clientsPerPage)
  const startIdx = (page - 1) * clientsPerPage
  const currentClients = clients.slice(startIdx, startIdx + clientsPerPage)

  const handlePrevPage = () => page > 1 && setPage(page - 1)
  const handleNextPage = () => page < totalPages && setPage(page + 1)

  if (loading) return <p className="text-sm text-muted">Loading top clients...</p>

  return (
    <section className="panel">
      <header className="panel-header">
        <div className="min-w-0">
          <h3 className="panel-title">Top clients</h3>
          <p className="panel-subtitle">{month} {year}</p>
        </div>
        <button onClick={handleAddClient} className="btn btn-glass btn-sm shrink-0">
          <Plus size={16} strokeWidth={1.75} />
          Add client
        </button>
      </header>

      {/* Client List */}
      <div className="overflow-x-auto">
        <table className="table-clean min-w-[720px]">
          <thead>
            <tr>
              <th className="w-10 text-center">#</th>
              <th>Name</th>
              <th>Email</th>
              <th className="w-28">Paid</th>
              <th className="w-24">Visits</th>
              <th>Notes</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {currentClients.length === 0 && (
              <tr>
                <td colSpan={7} className="!py-6 text-center text-muted">No top clients for this month yet.</td>
              </tr>
            )}
            {currentClients.map((client, idx) => (
              <tr key={client.id || idx}>
                <td className="text-center text-xs tabular-nums text-gray-500">{startIdx + idx + 1}</td>
                <td className="!py-2">
                  <input
                    className="field !h-8 !px-2 text-[13px]"
                    value={client.client_name}
                    onChange={e => handleChange(startIdx + idx, 'client_name', e.target.value)}
                    placeholder="Name"
                  />
                </td>
                <td className="!py-2">
                  <input
                    className="field !h-8 !px-2 text-[13px]"
                    value={client.email}
                    onChange={e => handleChange(startIdx + idx, 'email', e.target.value)}
                    placeholder="Email"
                  />
                </td>
                <td className="!py-2">
                  <input
                    className="field !h-8 !px-2 text-[13px] tabular-nums"
                    value={client.total_paid}
                    onChange={e =>
                      handleNumericChange(e, val => handleChange(startIdx + idx, 'total_paid', val))
                    }
                    placeholder="$ Paid"
                  />
                </td>
                <td className="!py-2">
                  <input
                    className="field !h-8 !px-2 text-[13px] tabular-nums"
                    value={client.num_visits}
                    onChange={e =>
                      handleNumericChange(e, val => handleChange(startIdx + idx, 'num_visits', val))
                    }
                    placeholder="Visits"
                  />
                </td>
                <td className="!py-2">
                  <input
                    className="field !h-8 !px-2 text-[13px]"
                    value={client.notes}
                    onChange={e => handleChange(startIdx + idx, 'notes', e.target.value)}
                    placeholder="Notes"
                  />
                </td>
                <td className="!py-2 text-right">
                  <button
                    onClick={() => handleRemoveClient(startIdx + idx)}
                    className="btn btn-ghost btn-sm !h-8 !px-2 hover:!text-[#FF8F7D]"
                    aria-label="Remove client"
                  >
                    <X size={16} strokeWidth={1.75} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] px-5 py-3">
        {/* Pagination */}
        {totalPages > 1 ? (
          <div className="flex items-center gap-2 text-xs text-muted">
            <button
              onClick={handlePrevPage}
              disabled={page === 1}
              className="btn btn-ghost btn-sm !h-8 !px-2"
              aria-label="Previous page"
            >
              <ChevronLeft size={16} strokeWidth={1.75} />
            </button>
            <span className="tabular-nums">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={handleNextPage}
              disabled={page === totalPages}
              className="btn btn-ghost btn-sm !h-8 !px-2"
              aria-label="Next page"
            >
              <ChevronRight size={16} strokeWidth={1.75} />
            </button>
          </div>
        ) : <span />}

        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary btn-sm"
        >
          {saving ? 'Saving...' : 'Save top clients'}
        </button>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="modal-backdrop flex items-center justify-center p-4">
          <div className="modal-surface w-full max-w-md text-ivory">
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
              <h4 className="text-[15px] font-semibold">Add new client</h4>
              <button onClick={() => setShowModal(false)} className="btn btn-ghost btn-sm !h-8 !px-2" aria-label="Close">
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>

            <div className="px-5 py-4">
              <div className="flex flex-col gap-3 text-sm">
                {['Name', 'Email', '$ Paid', 'Visits', 'Notes'].map((label, idx) => (
                  <input
                    key={label}
                    placeholder={label}
                    value={
                      idx === 0
                        ? newClient.client_name
                        : idx === 1
                        ? newClient.email
                        : idx === 2
                        ? newClient.total_paid
                        : idx === 3
                        ? newClient.num_visits
                        : newClient.notes
                    }
                    onChange={e => {
                      const val = e.target.value
                      if (label === '$ Paid' || label === 'Visits') {
                        handleNumericChange(e, v =>
                          setNewClient({
                            ...newClient,
                            [label === '$ Paid' ? 'total_paid' : 'num_visits']: v,
                          })
                        )
                      } else {
                        setNewClient({
                          ...newClient,
                          [label === 'Name'
                            ? 'client_name'
                            : label === 'Email'
                            ? 'email'
                            : 'notes']: val,
                        })
                      }
                    }}
                    className="field"
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-white/[0.07] px-5 py-3">
              <button onClick={() => setShowModal(false)} className="btn btn-ghost btn-sm">
                Cancel
              </button>
              <button onClick={handleSaveNewClient} className="btn btn-primary btn-sm">
                Add client
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
