'use client'

import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { Search } from 'lucide-react'

interface Props {
  user_id: string
  sms_engaged_current_week: boolean
}

interface Client {
  client_id: string
  first_name: string | null
  last_name: string | null
  phone_normalized: string
  visiting_type: string | null
  score: number
  days_since_last_visit: number
  days_overdue: number
  expected_visit_interval_days: number
}

const visitingTypeStyles: Record<string, string> = {
  consistent: 'bg-green-500/20 text-green-400',
  'semi-consistent': 'bg-blue-500/20 text-blue-400',
  'easy-going': 'bg-yellow-500/20 text-yellow-400',
  rare: 'bg-red-500/20 text-red-400',
  new: 'bg-gray-500/20 text-gray-400',
}

function toTitleCase(str: string | null) {
  if (!str) return ''
  return str.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

function ClientRow({ client }: { client: Client }) {
  const name = [toTitleCase(client.first_name), toTitleCase(client.last_name)].filter(Boolean).join(' ') || client.phone_normalized

  return (
    <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
      {/* Top row: name + badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-white text-sm font-semibold truncate">{name}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${visitingTypeStyles[client.visiting_type ?? ''] ?? 'bg-gray-500/20 text-gray-400'}`}>
            {client.visiting_type ?? 'unknown'}
          </span>
        </div>
        <span className="text-xs font-semibold text-sky-300 flex-shrink-0">Score: {client.score}</span>
      </div>

      {/* Bottom row: phone + stats | interval */}
      <div className="flex items-end justify-between mt-1.5 gap-2">
        <div className="flex gap-2 text-xs text-[#bdbdbd] flex-wrap">
          <span>{client.phone_normalized}</span>
          <span>•</span>
          <span className="text-orange-400">{client.days_overdue}d overdue</span>
          <span>•</span>
          <span>{client.days_since_last_visit}d since visit</span>
        </div>
        <span className="text-xs text-white/30 flex-shrink-0">Normally visits every {client.expected_visit_interval_days}d</span>
      </div>
    </div>
  )
}

export default function ClientHealth({ user_id, sms_engaged_current_week }: Props) {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [nudging, setNudging] = useState(false)
  const [engaged, setEngaged] = useState(sms_engaged_current_week)
  const [search, setSearch] = useState('')

  const fetchClients = async () => {
    try {
      const res = await fetch(
        `/api/client-messaging/preview-recipients?userId=${user_id}&algorithm=auto-nudge&limit=50`
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch clients')
      setClients(data.clients ?? [])
    } catch (err) {
      console.error('Error fetching client health:', err)
      toast.error('Failed to load client health')
    } finally {
      setLoading(false)
    }
  }

  const handleNudge = async () => {
    setNudging(true)
    try {
      const res = await fetch('/api/barber-nudge/manual-smart-bucket', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to trigger nudge')
      toast.success('Clients nudged successfully!')
      setEngaged(true)
      await fetchClients()
    } catch (err) {
      console.error('Error triggering nudge:', err)
      toast.error('Failed to nudge clients')
    } finally {
      setNudging(false)
    }
  }

  useEffect(() => {
    fetchClients()
  }, [user_id])

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase()
    const name = [c.first_name, c.last_name].filter(Boolean).join(' ').toLowerCase()
    return name.includes(q) || c.phone_normalized.includes(q)
  })

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between mb-1 flex-shrink-0">
        <h2 className="text-[#d1e2c5] font-semibold text-sm sm:text-base">Client Health</h2>
        {!loading && <span className="text-xs text-[#bdbdbd]">{clients.length} clients</span>}
      </div>
      <p className="text-xs text-[#bdbdbd] mb-3 flex-shrink-0">Top clients due for a nudge</p>

      {/* Search */}
      <div className="relative mb-3 flex-shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or number..."
          className="w-full bg-[#1e2420] border border-white/15 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-lime-400/30 transition-colors"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[#bdbdbd] text-sm animate-pulse">Loading...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[#bdbdbd] text-sm">{search ? 'No results found' : 'No clients due for a nudge'}</span>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
          {filtered.map((client) => (
            <ClientRow key={client.client_id} client={client} />
          ))}
        </div>
      )}

      {/* Nudge Clients Button */}
      <button
        onClick={handleNudge}
        disabled={engaged || nudging}
        className={`mt-3 w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex-shrink-0 ${
          engaged
            ? 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5'
            : 'bg-lime-400/10 border border-lime-400/20 text-lime-400 hover:bg-lime-400/20 hover:border-lime-400/40'
        }`}
      >
        {nudging ? 'Nudging...' : engaged ? 'Already nudged this week' : 'Nudge Clients'}
      </button>
    </div>
  )
}