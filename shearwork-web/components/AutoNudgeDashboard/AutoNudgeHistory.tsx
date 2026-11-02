'use client'

import { useEffect, useState } from 'react'
import { Loader2, Users, Clock, Check, X, MessageSquare } from 'lucide-react'
import { supabase } from '@/utils/supabaseClient'
import ClientMessageHistory from '@/components/AutoNudgeDashboard/ClientMessageHistory'
import { EmptyState } from '@/components/ui/AppKit'

interface Props {
  user_id: string
}

interface SMSRecipient {
  client_id: string | null
  full_name: string | null
  phone: string | null
  status: 'booked' | 'messaged' | 'pending' | 'failed'
  has_replied: boolean
  has_unread: boolean
  failure_reason?: string
  service?: string
  price?: string
  appointment_date?: string
  messaged_at?: string
  scheduled_send?: Date
}

const STATUS_BADGE: Record<SMSRecipient['status'], { label: string; classes: string }> = {
  booked:   { label: 'Booked',   classes: 'badge-sage' },
  messaged: { label: 'Messaged', classes: 'badge-info' },
  pending:  { label: 'Pending',  classes: 'badge-warn' },
  failed:   { label: 'Failed',   classes: 'badge-danger' },
}

const DAY_OFFSET: Record<string, number> = {
  Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3,
  Friday: 4, Saturday: 5, Sunday: 6,
}

const TIME_SEND: Record<string, { hour: number; minute: number }> = {
  Morning:   { hour: 18, minute: 0  },
  Midday:    { hour: 18, minute: 30 },
  Afternoon: { hour: 16, minute: 0  },
  Night:     { hour: 20, minute: 0  },
}

const getScheduledSendDate = (bucket: string | null, campaignStart: string): Date => {
  const monday = new Date(campaignStart)
  monday.setHours(0, 0, 0, 0)

  let dayOffset = 0
  let hour = 18
  let minute = 30

  if (bucket && bucket !== 'Low-data') {
    const [dayPart, timePart] = bucket.split('|')
    dayOffset = dayPart !== 'Any-day' ? (DAY_OFFSET[dayPart] ?? 0) : 0
    const sendTime = timePart !== 'Any-time' ? TIME_SEND[timePart] : null
    hour   = sendTime?.hour   ?? 18
    minute = sendTime?.minute ?? 30
  }

  const send = new Date(monday)
  send.setDate(monday.getDate() + dayOffset)
  send.setHours(hour, minute, 0, 0)
  return send
}

const getCurrentISOWeek = (): string => {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  const startOfYear = new Date(monday.getFullYear(), 0, 1)
  const weekNumber = Math.ceil(((monday.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
  return `${monday.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`
}

const formatPhoneNumber = (phone: string | null) => {
  if (!phone) return 'No phone'
  const digits = phone.replace(/\D/g, '')
  const d = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`
  return phone
}

const capitalizeName = (name: string) =>
  name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')

export default function AutoNudgeHistory({ user_id }: Props) {
  const [recipients, setRecipients] = useState<SMSRecipient[]>([])
  const [totalClients, setTotalClients] = useState(0)
  const [clientsBooked, setClientsBooked] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeThread, setActiveThread] = useState<{ phone: string; name: string } | null>(null)

  const openThread = async (phone: string, name: string) => {
    // Mark all unread replies from this client as read
    await supabase
      .from('sms_replies')
      .update({ ui_read: true })
      .eq('user_id', user_id)
      .eq('phone_number', phone)
      .eq('ui_read', false)

    // Optimistically clear unread state in local recipients
    setRecipients(prev =>
      prev.map(r => r.phone === phone ? { ...r, has_unread: false } : r)
    )

    setActiveThread({ phone, name })
  }

  useEffect(() => {
    const fetchCurrentWeek = async () => {
      try {
        const isoWeek = getCurrentISOWeek()

        const { data: bucket, error: bucketError } = await supabase
          .from('sms_smart_buckets')
          .select('bucket_id, clients, campaign_start, total_clients')
          .eq('user_id', user_id)
          .eq('iso_week', isoWeek)
          .single()

        if (bucketError || !bucket) {
          setLoading(false)
          return
        }

        setTotalClients(bucket.total_clients ?? 0)

        const { data: smsSentRows } = await supabase
          .from('sms_sent')
          .select('phone_normalized, is_sent, reason, created_at')
          .eq('smart_bucket_id', bucket.bucket_id)
          .eq('user_id', user_id)
          .order('created_at', { ascending: false })

        const smsSentMap = new Map<string, { is_sent: boolean; reason: string | null; created_at: string | null }>()
        for (const row of smsSentRows || []) {
          if (row.phone_normalized && !smsSentMap.has(row.phone_normalized)) {
            smsSentMap.set(row.phone_normalized, {
              is_sent: row.is_sent,
              reason: row.reason ?? null,
              created_at: row.created_at ?? null,
            })
          }
        }

        const { data: successData } = await supabase
          .from('barber_nudge_success')
          .select('client_ids, services, prices, appointment_dates')
          .eq('user_id', user_id)
          .eq('iso_week_number', isoWeek)
          .single()

        const bookedClientIds: string[] = successData?.client_ids || []
        const services: string[] = successData?.services || []
        const prices: string[] = successData?.prices || []
        const appointmentDates: string[] = successData?.appointment_dates || []

        setClientsBooked(bookedClientIds.length)

        // Compute Monday–Sunday bounds for the current ISO week
        const weekMonday = new Date(bucket.campaign_start)
        weekMonday.setHours(0, 0, 0, 0)
        const weekSunday = new Date(weekMonday)
        weekSunday.setDate(weekMonday.getDate() + 6)
        weekSunday.setHours(23, 59, 59, 999)

        const { data: replyRows } = await supabase
          .from('sms_replies')
          .select('phone_number')
          .eq('user_id', user_id)
          .not('client_id', 'is', null)
          .gte('received_at', weekMonday.toISOString())
          .lte('received_at', weekSunday.toISOString())

        const repliedPhones = new Set((replyRows || []).map(r => r.phone_number))

        // Phones that have at least one unread reply this week
        const { data: unreadRows } = await supabase
          .from('sms_replies')
          .select('phone_number')
          .eq('user_id', user_id)
          .not('client_id', 'is', null)
          .eq('ui_read', false)
          .gte('received_at', weekMonday.toISOString())
          .lte('received_at', weekSunday.toISOString())

        const unreadPhones = new Set((unreadRows || []).map(r => r.phone_number))

        const recipientsList: SMSRecipient[] = (bucket.clients || []).map((client: {
          client_id: string
          phone: string
          full_name: string
          appointment_datecreated_bucket: string | null
        }) => {
          const bookedIndex = client.client_id ? bookedClientIds.indexOf(client.client_id) : -1
          const isBooked = bookedIndex !== -1
          const sentRow = client.phone ? smsSentMap.get(client.phone) : undefined
          const isMessaged = sentRow?.is_sent === true
          const isFailed = sentRow?.is_sent === false

          let status: SMSRecipient['status'] = 'pending'
          if (isBooked) status = 'booked'
          else if (isMessaged) status = 'messaged'
          else if (isFailed) status = 'failed'

          return {
            client_id: client.client_id,
            full_name: client.full_name || null,
            phone: client.phone || null,
            status,
            has_replied: client.phone ? repliedPhones.has(client.phone) : false,
            has_unread: client.phone ? unreadPhones.has(client.phone) : false,
            failure_reason: isFailed ? (sentRow?.reason || 'Unknown error') : undefined,
            service: isBooked ? services[bookedIndex] : undefined,
            price: isBooked ? prices[bookedIndex] : undefined,
            appointment_date: isBooked ? appointmentDates[bookedIndex] : undefined,
            messaged_at: isMessaged ? (sentRow?.created_at ?? undefined) : undefined,
            scheduled_send: status === 'pending'
              ? getScheduledSendDate(client.appointment_datecreated_bucket, bucket.campaign_start)
              : undefined,
          }
        })

        const ORDER = { booked: 0, messaged: 1, pending: 2, failed: 3 }
        recipientsList.sort((a, b) => ORDER[a.status] - ORDER[b.status])

        setRecipients(recipientsList)
      } catch (err) {
        console.error('Failed to fetch AutoNudge history:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchCurrentWeek()
  }, [user_id])

  return (
    <>
      <div className="flex h-full flex-col">
        <div className="mb-3 flex flex-shrink-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="panel-title">AutoNudge history</h2>
            <p className="panel-subtitle">This week&apos;s campaign</p>
          </div>
          {!loading && recipients.length > 0 && (
            <div className="flex flex-shrink-0 items-center gap-2 pt-0.5 text-xs tabular-nums text-muted">
              <span className="font-semibold text-sage-bright">{clientsBooked} booked</span>
              <span aria-hidden="true">&middot;</span>
              <span>{totalClients} sent</span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-gray-500" strokeWidth={1.75} />
          </div>
        ) : recipients.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState icon={Users} title="No campaign this week yet">
              Activate your auto-nudge by replying to our SMS or clicking{' '}
              <span className="font-medium text-ivory">Nudge clients</span>.
            </EmptyState>
          </div>
        ) : (
          <ul className="min-h-0 flex-1 divide-y divide-white/[0.06] overflow-y-auto border-t border-white/[0.07] pr-1.5">
            {recipients.map((recipient, index) => {
              const badge = STATUS_BADGE[recipient.status]
              const isBooked = recipient.status === 'booked'

              return (
                <li
                  key={`${recipient.client_id ?? recipient.phone}-${index}`}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4"
                >
                  {/* Name + phone */}
                  <div className="min-w-0 sm:w-[28%] sm:flex-shrink-0">
                    <p className="truncate text-sm font-medium text-ivory">
                      {recipient.full_name ? capitalizeName(recipient.full_name) : <span className="font-normal text-gray-500">Unknown</span>}
                    </p>
                    <p className="mt-0.5 text-xs tabular-nums text-gray-500">{formatPhoneNumber(recipient.phone)}</p>
                  </div>

                  {/* Status */}
                  <div className="flex flex-wrap items-center gap-1.5 sm:w-36 sm:flex-shrink-0">
                    <span className={`badge ${badge.classes}`}>
                      {recipient.status === 'booked' && <Check className="h-3 w-3" strokeWidth={2} />}
                      {recipient.status === 'failed' && <X className="h-3 w-3" strokeWidth={2} />}
                      {badge.label}
                    </span>
                    {recipient.has_replied && <span className="badge">Replied</span>}
                  </div>

                  {/* Detail */}
                  <div className="min-w-0 flex-1 text-xs text-muted">
                    {isBooked && (recipient.service || recipient.appointment_date) && (
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          {recipient.service && <p className="truncate font-medium text-ivory">{recipient.service}</p>}
                          {recipient.appointment_date && (
                            <p className="mt-0.5 tabular-nums text-gray-500">{new Date(recipient.appointment_date).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                            })}</p>
                          )}
                        </div>
                        {recipient.price && <p className="flex-shrink-0 text-sm font-semibold tabular-nums text-sage-bright">${recipient.price}</p>}
                      </div>
                    )}

                    {recipient.status === 'failed' && recipient.failure_reason && (
                      <p className="text-[#D99A8B]">{recipient.failure_reason}</p>
                    )}

                    {recipient.status === 'messaged' && recipient.messaged_at && (
                      <p className="flex items-center gap-1.5 tabular-nums">
                        <Clock className="h-3 w-3 flex-shrink-0 text-gray-500" strokeWidth={1.75} />
                        <span>Messaged {new Date(recipient.messaged_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                        })}</span>
                      </p>
                    )}
                    {recipient.status === 'pending' && recipient.scheduled_send && (
                      <p className="flex items-center gap-1.5 tabular-nums">
                        <Clock className="h-3 w-3 flex-shrink-0 text-gray-500" strokeWidth={1.75} />
                        <span>Will be messaged {recipient.scheduled_send.toLocaleDateString('en-US', {
                          weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                        })}</span>
                      </p>
                    )}
                  </div>

                  {/* Message history */}
                  {recipient.phone && (
                    <button
                      type="button"
                      onClick={() => openThread(
                        recipient.phone!,
                        recipient.full_name ? capitalizeName(recipient.full_name) : recipient.phone!,
                      )}
                      title="View message history"
                      className="btn btn-glass btn-sm h-8 flex-shrink-0 self-start px-2.5 text-xs sm:self-center"
                    >
                      <span className="relative">
                        <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.75} />
                        {recipient.has_unread && (
                          <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-sage" />
                        )}
                      </span>
                      <span>Messages</span>
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {/* See all weeks — always visible regardless of campaign state */}
        <a
          href="/client-manager?view=sms"
          className="btn btn-glass btn-sm mt-3 w-full flex-shrink-0"
        >
          See all weeks
        </a>
      </div>

      {/* Message thread modal */}
      {activeThread && (
        <ClientMessageHistory
          user_id={user_id}
          client_phone={activeThread.phone}
          client_name={activeThread.name}
          onClose={() => setActiveThread(null)}
        />
      )}
    </>
  )
}