'use client'

import { useEffect, useState } from 'react'
import { Loader2, Users, Clock } from 'lucide-react'
import { supabase } from '@/utils/supabaseClient'
import ClientMessageHistory from '@/components/AutoNudgeDashboard/ClientMessageHistory'

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
  booked:   { label: '✓ Booked',  classes: 'bg-lime-300/10 text-lime-300 border-lime-300/20' },
  messaged: { label: 'Messaged',  classes: 'bg-sky-300/10 text-sky-300 border-sky-300/20' },
  pending:  { label: 'Pending',   classes: 'bg-amber-300/10 text-amber-300 border-amber-300/20' },
  failed:   { label: '✗ Failed',  classes: 'bg-red-400/10 text-red-400 border-red-400/20' },
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
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-1 flex-shrink-0">
          <h2 className="text-[#d1e2c5] font-semibold text-sm sm:text-base">AutoNudge History</h2>
          {!loading && recipients.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-[#bdbdbd]">
              <span className="text-lime-300 font-semibold">{clientsBooked} booked</span>
              <span>·</span>
              <span>{totalClients} sent</span>
            </div>
          )}
        </div>
        <p className="text-xs text-[#bdbdbd] mb-3 flex-shrink-0">This week's campaign</p>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-[#bdbdbd] animate-spin" />
          </div>
        ) : recipients.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
            <Users className="w-12 h-12 text-white/20" />
            <p className="text-xl font-semibold text-white/70 leading-relaxed">No campaign this week yet.</p>
            <p className="text-sm text-white/40 leading-relaxed">Activate your auto-nudge by replying to our SMS or clicking the <span className="text-white/60 font-semibold">Nudge Clients</span> button.</p>
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-2 min-h-0 overflow-y-auto auto-rows-min">
            {recipients.map((recipient, index) => {
              const badge = STATUS_BADGE[recipient.status]
              const isBooked = recipient.status === 'booked'

              return (
                <div
                  key={`${recipient.client_id ?? recipient.phone}-${index}`}
                  className={`rounded-xl border p-3 flex flex-col justify-between ${
                    isBooked
                      ? 'bg-lime-300/5 border-lime-300/15'
                      : recipient.status === 'messaged'
                      ? 'bg-sky-300/5 border-sky-300/15'
                      : recipient.status === 'failed'
                      ? 'bg-red-400/5 border-red-400/15'
                      : 'bg-white/[0.03] border-white/8'
                  }`}
                >
                  {/* Top: name + badges */}
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5 flex-wrap">
                      <p className="text-sm font-semibold text-white leading-snug">
                        {recipient.full_name ? capitalizeName(recipient.full_name) : <span className="text-white/30 font-normal">Unknown</span>}
                      </p>
                      <div className="flex items-center flex-wrap gap-1 flex-shrink-0 min-w-0">
                        <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.classes}`}>
                          {badge.label}
                        </span>
                        {recipient.has_replied && (
                          <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-[#73aa57]/10 text-[#73aa57] border-[#73aa57]/20">
                            Replied
                          </span>
                        )}
                        {recipient.phone && (
                          <button
                            onClick={() => openThread(
                              recipient.phone!,
                              recipient.full_name ? capitalizeName(recipient.full_name) : recipient.phone!,
                            )}
                            className="relative px-2 py-0.5 rounded-full text-[10px] font-semibold border border-violet-400/40 text-violet-300 bg-violet-400/10 hover:bg-violet-400/20 hover:border-violet-400/70 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            {recipient.has_unread && (
                              <span className="absolute -top-1 -right-0.5 w-2 h-2 rounded-full bg-red-500" />
                            )}
                            <span className="hidden sm:inline">Click to view message history</span>
                            <span className="sm:hidden">Message History</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-white/35">{formatPhoneNumber(recipient.phone)}</p>

                    {/* Booking details */}
                    {isBooked && (recipient.service || recipient.appointment_date) && (
                      <div className="pt-2 border-t border-white/8 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          {recipient.service && <p className="text-xs text-lime-300 font-semibold truncate">{recipient.service}</p>}
                          {recipient.appointment_date && (
                            <p className="text-xs text-white/35 mt-0.5">{new Date(recipient.appointment_date).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                            })}</p>
                          )}
                        </div>
                        {recipient.price && <p className="text-sm font-bold text-lime-300 flex-shrink-0">${recipient.price}</p>}
                      </div>
                    )}

                    {/* Failure reason */}
                    {recipient.status === 'failed' && recipient.failure_reason && (
                      <p className="text-xs text-red-400/70">{recipient.failure_reason}</p>
                    )}
                  </div>

                  {/* Bottom: timestamp */}
                  {recipient.status === 'messaged' && recipient.messaged_at && (
                    <div className="flex items-center gap-1.5 text-xs text-white/35 mt-2">
                      <Clock className="w-3 h-3 flex-shrink-0" />
                      <span>Messaged {new Date(recipient.messaged_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                      })}</span>
                    </div>
                  )}
                  {recipient.status === 'pending' && recipient.scheduled_send && (
                    <div className="flex items-center gap-1.5 text-xs text-white/35 mt-2">
                      <Clock className="w-3 h-3 flex-shrink-0" />
                      <span>Will be messaged {recipient.scheduled_send.toLocaleDateString('en-US', {
                        weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                      })}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* See all weeks — always visible regardless of campaign state */}
        <a
          href="/client-manager?view=sms"
          className="mt-3 w-full py-2.5 rounded-xl text-sm font-semibold text-center text-white border border-white/15 bg-white/5 hover:bg-white/10 hover:border-white/25 transition-colors flex-shrink-0 block"
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