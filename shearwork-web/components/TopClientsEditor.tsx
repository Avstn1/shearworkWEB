'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'

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

  if (loading) return <p className="text-gray-400">Loading top clients...</p>

  return (
    <div className="bg-zinc-900/60 border border-zinc-700/60 backdrop-blur-xl rounded-2xl p-6 shadow-[0_0_25px_rgba(255,255,255,0.05)]">
      <h3 className="text-lg font-semibold mb-4 text-white/90">Top Clients</h3>

      {/* Client List */}
      <div className="flex flex-col gap-3">
        {currentClients.map((client, idx) => (
          <div
            key={client.id || idx}
            className="grid grid-cols-11 gap-2 items-center bg-zinc-800/70 rounded-xl p-3 border border-zinc-700/50 hover:border-amber-300/30 hover:shadow-[0_0_10px_rgba(255,200,100,0.2)] transition-all"
          >
            <div className="col-span-1 text-xs text-gray-400 text-center">
              {startIdx + idx + 1}
            </div>

            <input
              className="col-span-2 bg-zinc-900/90 border border-zinc-700 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-300"
              value={client.client_name}
              onChange={e => handleChange(startIdx + idx, 'client_name', e.target.value)}
              placeholder="Name"
            />
            <input
              className="col-span-3 bg-zinc-900/90 border border-zinc-700 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-300"
              value={client.email}
              onChange={e => handleChange(startIdx + idx, 'email', e.target.value)}
              placeholder="Email"
            />
            <input
              className="col-span-1.5 bg-zinc-900/90 border border-zinc-700 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-300"
              value={client.total_paid}
              onChange={e =>
                handleNumericChange(e, val => handleChange(startIdx + idx, 'total_paid', val))
              }
              placeholder="$ Paid"
            />
            <input
              className="col-span-1.5 bg-zinc-900/90 border border-zinc-700 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-300"
              value={client.num_visits}
              onChange={e =>
                handleNumericChange(e, val => handleChange(startIdx + idx, 'num_visits', val))
              }
              placeholder="Visits"
            />
            <input
              className="col-span-2 bg-zinc-900/90 border border-zinc-700 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-300"
              value={client.notes}
              onChange={e => handleChange(startIdx + idx, 'notes', e.target.value)}
              placeholder="Notes"
            />
            <button
              onClick={() => handleRemoveClient(startIdx + idx)}
              className="col-span-0.5 bg-red-600/90 hover:bg-red-700 text-white rounded-md px-2 py-1 text-xs transition"
            >
              ✕
            </button>
          </div>
        ))}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-3 text-xs text-gray-400">
            <button
              onClick={handlePrevPage}
              disabled={page === 1}
              className={`px-3 py-1 rounded-md transition-all ${
                page === 1
                  ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-white hover:border-amber-300/40'
              }`}
            >
              ← Prev
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={handleNextPage}
              disabled={page === totalPages}
              className={`px-3 py-1 rounded-md transition-all ${
                page === totalPages
                  ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-white hover:border-amber-300/40'
              }`}
            >
              Next →
            </button>
          </div>
        )}

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <button
            onClick={handleAddClient}
            className="bg-amber-400/90 hover:bg-amber-300 text-black rounded-md px-4 py-2 text-sm font-semibold shadow-[0_0_10px_rgba(255,200,100,0.3)] transition"
          >
            + Add Client
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-amber-400/90 hover:bg-amber-300 text-black rounded-md px-4 py-2 text-sm font-semibold shadow-[0_0_10px_rgba(255,200,100,0.3)] transition"
          >
            {saving ? 'Saving...' : 'Save Top Clients'}
          </button>
        </div>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900/95 border border-zinc-700/60 rounded-2xl p-6 w-[90%] max-w-md text-white shadow-[0_0_30px_rgba(255,200,100,0.15)]">
            <h4 className="text-lg font-semibold mb-4">Add New Client</h4>

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
                  className="bg-zinc-800/90 border border-zinc-700 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-amber-300"
                />
              ))}
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-md bg-zinc-700/70 hover:bg-zinc-600 text-sm transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNewClient}
                className="px-4 py-2 rounded-md bg-amber-400/90 hover:bg-amber-300 text-black font-semibold text-sm transition"
              >
                Add Client
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
