'use client'

import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { Search } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/utils/supabaseClient'

interface Props {
  user_id: string
  sms_engaged_current_week: boolean
  onNudgeSuccess: () => void
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

const computeScore = (
  client: {
    visiting_type: string | null
    avg_weekly_visits: number | null
    last_appt: string | null
    date_last_sms_sent: string | null
  },
  skipSmsGate = false
): {
  score: number
  days_since_last_visit: number
  expected_visit_interval_days: number
  days_overdue: number
} => {
  const today = new Date()
  const lastApptDate = client.last_appt ? new Date(client.last_appt) : null
  const lastSmsSentDate = client.date_last_sms_sent ? new Date(client.date_last_sms_sent) : null

  if (!lastApptDate) return { score: 0, days_since_last_visit: 0, expected_visit_interval_days: 0, days_overdue: 0 }

  const days_since_last_visit = Math.floor((today.getTime() - lastApptDate.getTime()) / (1000 * 60 * 60 * 24))
  const daysSinceLastSms = lastSmsSentDate
    ? Math.floor((today.getTime() - lastSmsSentDate.getTime()) / (1000 * 60 * 60 * 24))
    : Infinity

  const expected_visit_interval_days = client.avg_weekly_visits
    ? Math.round(7 / client.avg_weekly_visits)
    : 0

  const days_overdue = Math.max(0, days_since_last_visit - expected_visit_interval_days)

  if (!skipSmsGate && (daysSinceLastSms < 14 || days_overdue < 14)) {
    return { score: 0, days_since_last_visit, expected_visit_interval_days, days_overdue }
  }

  let score = 0
  if (client.visiting_type === 'consistent') score = 195 + days_overdue * 3
  else if (client.visiting_type === 'semi-consistent') score = 200 + days_overdue * 3
  else if (client.visiting_type === 'easy-going') score = 25 + Math.min(days_overdue, 10)
  else if (client.visiting_type === 'rare') score = 10

  return { score, days_since_last_visit, expected_visit_interval_days, days_overdue }
}



function ClientRow({ client, showMessaged }: { client: Client; showMessaged?: boolean }) {
  const name =
    [toTitleCase(client.first_name), toTitleCase(client.last_name)].filter(Boolean).join(' ') ||
    client.phone_normalized

  return (
    <div className={`p-4 border rounded-xl ${
      showMessaged
        ? 'bg-sky-300/5 border-sky-300/15'
        : 'bg-white/5 border-white/10'
    }`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-white text-sm font-semibold truncate">{name}</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
              visitingTypeStyles[client.visiting_type ?? ''] ?? 'bg-gray-500/20 text-gray-400'
            }`}
          >
            {client.visiting_type ?? 'unknown'}
          </span>
          {showMessaged && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-400/10 text-sky-400 border border-sky-400/20 flex-shrink-0">
              Messaged
            </span>
          )}
        </div>
        <span className="text-xs font-semibold text-sky-300 flex-shrink-0">Score: {client.score}</span>
      </div>
      <div className="flex items-end justify-between mt-1.5 gap-2">
        <div className="flex gap-2 text-xs text-[#bdbdbd] flex-wrap">
          <span>{client.phone_normalized}</span>
          <span>•</span>
          <span className="text-orange-400">{client.days_overdue}d overdue</span>
          <span>•</span>
          <span>{client.days_since_last_visit}d since visit</span>
        </div>
        <span className="text-xs text-white/30 flex-shrink-0">
          Normally visits every {client.expected_visit_interval_days}d
        </span>
      </div>
    </div>
  )
}

export default function ClientHealth({ user_id, sms_engaged_current_week, onNudgeSuccess }: Props) {
  const [tab, setTab] = useState<'prospects' | 'unbooked'>('prospects')

  // Tab 1
  const [clients, setClients] = useState<Client[]>([])
  const [loadingProspects, setLoadingProspects] = useState(true)

  // Tab 2
  const [unbookedClients, setUnbookedClients] = useState<Client[]>([])
  const [loadingUnbooked, setLoadingUnbooked] = useState(true)

  const [nudging, setNudging] = useState(false)
  const [engaged, setEngaged] = useState(sms_engaged_current_week)
  const [search, setSearch] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

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
      setLoadingProspects(false)
    }
  }

  const fetchUnbooked = async () => {
    try {
      // Fetch the 2 most recent campaigns regardless of current week
      const { data: buckets } = await supabase
        .from('sms_smart_buckets')
        .select('clients, iso_week')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })
        .limit(2)

      if (!buckets || buckets.length === 0) {
        setUnbookedClients([])
        setLoadingUnbooked(false)
        return
      }

      const bucketWeeks = buckets.map((b) => b.iso_week)

      const allMessaged: { client_id: string }[] = []
      for (const bucket of buckets) {
        for (const c of bucket.clients || []) {
          if (c.client_id && !allMessaged.find((m) => m.client_id === c.client_id)) {
            allMessaged.push(c)
          }
        }
      }

      if (allMessaged.length === 0) {
        setUnbookedClients([])
        setLoadingUnbooked(false)
        return
      }

      const { data: successRows } = await supabase
        .from('barber_nudge_success')
        .select('client_ids')
        .eq('user_id', user_id)
        .in('iso_week_number', bucketWeeks)

      const bookedIds = new Set<string>()
      for (const row of successRows || []) {
        for (const id of row.client_ids || []) bookedIds.add(id)
      }

      const unbookedIds = allMessaged
        .filter((c) => !bookedIds.has(c.client_id))
        .map((c) => c.client_id)

      if (unbookedIds.length === 0) {
        setUnbookedClients([])
        setLoadingUnbooked(false)
        return
      }

      const { data: acuityData } = await supabase
        .from('acuity_clients')
        .select(
          'client_id, first_name, last_name, phone_normalized, visiting_type, avg_weekly_visits, last_appt, date_last_sms_sent'
        )
        .eq('user_id', user_id)
        .in('client_id', unbookedIds)

      const result: Client[] = (acuityData || []).map((c) => {
        const { score, days_since_last_visit, expected_visit_interval_days, days_overdue } =
          computeScore(c, true)
        return {
          client_id: c.client_id,
          first_name: c.first_name,
          last_name: c.last_name,
          phone_normalized: c.phone_normalized ?? '',
          visiting_type: c.visiting_type,
          score,
          days_since_last_visit,
          days_overdue,
          expected_visit_interval_days,
        }
      })

      result.sort((a, b) => b.score - a.score)
      setUnbookedClients(result)
    } catch (err) {
      console.error('Error fetching unbooked clients:', err)
      toast.error('Failed to load unbooked clients')
    } finally {
      setLoadingUnbooked(false)
    }
  }

  const getClientCount = (): number => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    let mondays = 0
    for (let d = 1; d <= daysInMonth; d++) {
      if (new Date(year, month, d).getDay() === 1) mondays++
    }
    return mondays >= 5 ? 8 : 10
  }

  const clientCount = getClientCount()

  const handleNudge = async () => {
    setNudging(true)
    try {
      const res = await fetch('/api/barber-nudge/manual-smart-bucket', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to trigger nudge')
      toast.success('Your auto-nudge was triggered successfully!')
      setEngaged(true)
      onNudgeSuccess()
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
    fetchUnbooked()
  }, [user_id])

  const activeList = tab === 'prospects' ? clients : unbookedClients
  const loading = tab === 'prospects' ? loadingProspects : loadingUnbooked

  const filtered = activeList.filter((c) => {
    const q = search.toLowerCase()
    const name = [c.first_name, c.last_name].filter(Boolean).join(' ').toLowerCase()
    return name.includes(q) || c.phone_normalized.includes(q)
  })

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between mb-1 flex-shrink-0">
        <h2 className="text-[#d1e2c5] font-semibold text-sm sm:text-base">Clients at Risk</h2>
        {!loading && (
          <span className="text-xs text-[#bdbdbd]">{activeList.length} clients</span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-3 bg-white/5 rounded-xl p-1 flex-shrink-0">
        <button
          onClick={() => { setTab('prospects'); setSearch('') }}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            tab === 'prospects'
              ? 'bg-white/10 text-white'
              : 'text-white/35 hover:text-white/60'
          }`}
        >
          Prospects
        </button>
        <button
          onClick={() => { setTab('unbooked'); setSearch('') }}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            tab === 'unbooked'
              ? 'bg-white/10 text-white'
              : 'text-white/35 hover:text-white/60'
          }`}
        >
          Pending Follow-up
        </button>
      </div>

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
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
          <p className="text-xl font-semibold text-white/70 leading-relaxed">
            {search
              ? 'No results found'
              : tab === 'prospects'
              ? 'No clients due for a nudge'
              : 'Everyone messaged has booked 🎉'}
          </p>
          {!search && tab === 'prospects' && (
            <p className="text-sm text-white/40 leading-relaxed">
              Activate your auto-nudge by replying to our SMS or clicking the{' '}
              <span className="text-white/60 font-semibold">Nudge Clients</span> button.
            </p>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
          {filtered.map((client) => (
            <ClientRow key={client.client_id} client={client} showMessaged={tab === 'unbooked'} />
          ))}
        </div>
      )}

      {/* Nudge Clients Button */}
      <button
        onClick={() => setShowConfirm(true)}
        disabled={engaged || nudging}
        className={`mt-3 w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex-shrink-0 ${
          engaged
            ? 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5'
            : 'bg-lime-400/10 border border-lime-400/20 text-lime-400 hover:bg-lime-400/20 hover:border-lime-400/40'
        }`}
      >
        Nudge Clients
      </button>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1a1f1b] border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4"
            >
              <div>
                <h3 className="text-white font-bold text-lg">Start this week's nudge?</h3>
                <p className="text-white/50 text-sm mt-2 leading-relaxed">
                  We'll reach out to your top{' '}
                  <span className="text-white font-semibold">{clientCount} clients</span> who are
                  overdue for a visit — prioritizing your most consistent ones first. You'll get a
                  report on Wednesday at 10am.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white/40 border border-white/10 hover:border-white/20 hover:text-white/60 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowConfirm(false)
                    handleNudge()
                  }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-lime-400/10 border border-lime-400/20 text-lime-400 hover:bg-lime-400/20 hover:border-lime-400/40 transition-colors"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}