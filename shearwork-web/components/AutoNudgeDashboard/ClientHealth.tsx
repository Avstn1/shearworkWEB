'use client'

import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { Search, X, UserCheck, SearchX, PartyPopper, HeartPulse, Phone } from 'lucide-react'
import { IconTile } from '@/components/ui/AppKit'
import { NUDGING_PAUSED } from '@/lib/featureFlags'
import { useFitCount } from '@/hooks/useFitCount'
import ShowAllModal, { ShowAllButton } from '@/components/ui/ShowAllModal'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/utils/supabaseClient'
import { EmptyState, Segmented } from '@/components/ui/AppKit'

interface Props {
  /** Show this many rows (phones, natural page scroll) instead of measuring the card */
  maxRows?: number
  user_id: string
  sms_engaged_current_week: boolean
  date_autonudge_enabled: string | null
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

const VISITING_TYPE_BADGE: Record<string, string> = {
  consistent: 'badge-sage',
  'semi-consistent': 'badge-info',
  'easy-going': 'badge-warn',
  rare: 'badge-danger',
  new: '',
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

const TORONTO_TZ = 'America/Toronto'

function getTorontoDateComponents(date: Date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TORONTO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)

  return {
    year: parseInt(parts.find(p => p.type === 'year')!.value),
    month: parseInt(parts.find(p => p.type === 'month')!.value) - 1,
    day: parseInt(parts.find(p => p.type === 'day')!.value),
    hours: parseInt(parts.find(p => p.type === 'hour')!.value),
    minutes: parseInt(parts.find(p => p.type === 'minute')!.value),
    seconds: parseInt(parts.find(p => p.type === 'second')!.value),
  }
}

function getReportDateLabel(): string {
  const now = new Date()
  const { year, month, day } = getTorontoDateComponents(now)
  const todayToronto = new Date(year, month, day)

  // Find this week's Sunday
  const dayOfWeek = todayToronto.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
  const sunday = new Date(todayToronto)
  sunday.setDate(todayToronto.getDate() + daysUntilSunday)

  return sunday.toLocaleDateString('en-CA', {
    timeZone: TORONTO_TZ,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }) + ' at 10pm'
}

function initialsOf(client: Client): string {
  const letters = [client.first_name, client.last_name]
    .map(part => part?.trim()?.[0])
    .filter((ch): ch is string => Boolean(ch && /\p{L}/u.test(ch)))
  return letters.join('').toUpperCase() || '?'
}

/** One client: big tap targets on phones (initials, name, status chips, call button). */
function ClientRow({ client, showMessaged }: { client: Client; showMessaged?: boolean }) {
  const name =
    [toTitleCase(client.first_name), toTitleCase(client.last_name)].filter(Boolean).join(' ') ||
    client.phone_normalized

  return (
    <li className="py-3 first:pt-1 last:pb-1">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-[rgb(255_122_102/0.14)] text-sm font-semibold text-[#FFA799] ring-1 ring-inset ring-[rgb(255_122_102/0.28)]">
          {initialsOf(client)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold text-ivory md:text-sm">{name}</span>
            {showMessaged && <span className="badge flex-shrink-0">Messaged</span>}
            <span className="ml-auto hidden flex-shrink-0 text-xs tabular-nums text-muted sm:inline">
              Score <span className="font-semibold text-ivory">{Math.round(client.score)}</span>
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs tabular-nums">
            <span className="badge badge-danger">{client.days_overdue}d overdue</span>
            <span className={`badge ${VISITING_TYPE_BADGE[client.visiting_type ?? ''] ?? ''}`}>
              {client.visiting_type ?? 'unknown'}
            </span>
            <span className="text-gray-500">
              every {client.expected_visit_interval_days}d &middot; last {client.days_since_last_visit}d ago
            </span>
          </div>
        </div>

        {client.phone_normalized && (
          <a
            href={`tel:${client.phone_normalized}`}
            aria-label={`Call ${name}`}
            title={client.phone_normalized}
            className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-white/[0.05] text-sage-bright ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.09]"
          >
            <Phone className="h-[18px] w-[18px]" strokeWidth={1.9} />
          </a>
        )}
      </div>
    </li>
  )
}

export default function ClientHealth({ user_id, sms_engaged_current_week, date_autonudge_enabled, onNudgeSuccess, maxRows }: Props) {
  const [tab, setTab] = useState<'prospects' | 'unbooked'>('prospects')

  const [clients, setClients] = useState<Client[]>([])
  const [loadingProspects, setLoadingProspects] = useState(true)

  const [unbookedClients, setUnbookedClients] = useState<Client[]>([])
  const [loadingUnbooked, setLoadingUnbooked] = useState(true)

  const [nudging, setNudging] = useState(false)
  const [engaged, setEngaged] = useState(sms_engaged_current_week)
  const [search, setSearch] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const { ref: fitRef, count: measuredCount } = useFitCount<HTMLUListElement>({ fallbackRowHeight: 66, deps: [tab, search, loadingProspects, loadingUnbooked] })
  const fitCount = maxRows ?? measuredCount

  const reportDateLabel = getReportDateLabel()

  const isNudgeButtonDisabled = (): boolean => {
    if (engaged) return true
    if (nudging) return true
    if (!date_autonudge_enabled) return false

    const enabledAt = new Date(date_autonudge_enabled)

    // Get the calendar date of enabledAt + 1 day in Toronto time
    const nextDay = new Date(enabledAt.getTime() + 24 * 60 * 60 * 1000)
    const { year, month, day } = getTorontoDateComponents(nextDay)

    // Reconstruct as local Date at 10:00am, then find its UTC equivalent
    // by comparing what Toronto thinks "midnight" is for that date
    const localMidnight = new Date(year, month, day, 0, 0, 0)
    const torontoMidnightStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: TORONTO_TZ,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).format(localMidnight)
    // torontoMidnightStr tells us what Toronto clock reads for localMidnight (UTC)
    // We need the inverse: what UTC instant is 10:00am Toronto on that date?
    // Use the offset: utcOffset = localMidnight(UTC ms) - toronto-perceived-time(ms)
    const perceivedMs = new Date(torontoMidnightStr.replace(', ', 'T')).getTime()
    const utcOffset = localMidnight.getTime() - perceivedMs
    const unlockTime = new Date(new Date(year, month, day, 10, 0, 0).getTime() + utcOffset)

    return new Date() < unlockTime
  }

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
    if (NUDGING_PAUSED) return
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

  const nudgeDisabled = NUDGING_PAUSED || isNudgeButtonDisabled()

  return (
    <div className="flex h-full flex-col">

      {/* Header */}
      <div className="mb-3 hidden flex-shrink-0 items-center justify-between gap-2 md:flex">
        <div className="panel-heading tone-coral flex min-w-0 items-center gap-2.5" data-tone="coral">
          <IconTile icon={HeartPulse} tone="coral" size="sm" />
          <h2 className="panel-title">Clients at risk</h2>
        </div>
        {!loading && (
          <span className="text-xs tabular-nums text-muted">{activeList.length} clients</span>
        )}
      </div>

      {/* Tabs */}
      <Segmented
        className="mb-3 w-full flex-shrink-0"
        value={tab}
        onChange={(v) => { setTab(v); setSearch('') }}
        options={[
          { value: 'prospects', label: loadingProspects ? 'Prospects' : `Prospects · ${clients.length}` },
          { value: 'unbooked', label: loadingUnbooked ? 'Pending follow-up' : `Pending · ${unbookedClients.length}` },
        ]}
      />

      {/* Search */}
      <div className="relative mb-3 flex-shrink-0">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
          strokeWidth={1.75}
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or number"
          className="field pl-9"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <span className="text-sm text-muted">Loading&hellip;</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          {search ? (
            <EmptyState icon={SearchX} title="No results found" />
          ) : tab === 'prospects' ? (
            <EmptyState icon={UserCheck} title="No clients due for a nudge">
              Activate your auto-nudge by replying to our SMS or clicking{' '}
              <span className="font-medium text-ivory">Nudge clients</span>.
            </EmptyState>
          ) : (
            <EmptyState icon={PartyPopper} title="Everyone messaged has booked" />
          )}
        </div>
      ) : (
        <>
          {/* Show what fits (no scrolling inside the card); the rest is one tap away */}
          <ul ref={fitRef} className="min-h-0 flex-1 divide-y divide-white/[0.06] overflow-hidden">
            {filtered.slice(0, fitCount).map((client) => (
              <ClientRow key={client.client_id} client={client} showMessaged={tab === 'unbooked'} />
            ))}
          </ul>
          {filtered.length > fitCount && (
            <ShowAllButton total={filtered.length} onClick={() => setShowAll(true)} />
          )}
          <ShowAllModal
            open={showAll}
            onClose={() => setShowAll(false)}
            title={tab === 'prospects' ? `Clients at risk · ${filtered.length}` : `Pending follow-up · ${filtered.length}`}
          >
            <ul className="divide-y divide-white/[0.06]">
              {filtered.map((client) => (
                <ClientRow key={client.client_id} client={client} showMessaged={tab === 'unbooked'} />
              ))}
            </ul>
          </ShowAllModal>
        </>
      )}

      {/* Nudge Clients Button */}
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        disabled={nudgeDisabled}
        title={NUDGING_PAUSED ? 'Client nudging is paused for now' : undefined}
        className="btn btn-primary btn-sm mt-3 w-full flex-shrink-0 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {NUDGING_PAUSED ? 'Nudging paused' : 'Nudge clients'}
      </button>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="modal-backdrop flex items-center justify-center p-4"
            onClick={() => setShowConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="nudge-confirm-title"
              className="modal-surface flex w-full max-w-sm flex-col"
            >
              <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
                <h3 id="nudge-confirm-title" className="panel-title">Start this week&apos;s nudge?</h3>
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  aria-label="Close"
                  className="btn btn-ghost btn-sm h-8 w-8 px-0"
                >
                  <X className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </div>
              <p className="px-5 py-4 text-sm leading-relaxed text-muted">
                We&apos;ll reach out to your top{' '}
                <span className="font-medium text-ivory">{clientCount} clients</span> who are
                overdue for a visit, prioritizing your most consistent ones first. You&apos;ll get your
                results on{' '}
                <span className="font-medium text-ivory">{reportDateLabel}</span>.
              </p>
              <div className="flex justify-end gap-2 border-t border-white/[0.07] px-5 py-3">
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="btn btn-glass btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => { setShowConfirm(false); handleNudge() }}
                  className="btn btn-primary btn-sm"
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
