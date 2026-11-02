'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronUp, Loader2 } from 'lucide-react'
import { supabase } from '@/utils/supabaseClient'

interface Props {
  user_id: string
  client_phone: string
  client_name: string
  onClose: () => void
}

interface Message {
  id: string
  body: string
  direction: 'outbound' | 'inbound'
  timestamp: string
}

const PAGE_SIZE = 10

export default function ClientMessageHistory({ user_id, client_phone, client_name, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchMessages = async (currentPage: number) => {
    const limit = currentPage * PAGE_SIZE

    // Outbound: sms_sent rows sent to this client by this barber
    const { data: sentRows } = await supabase
      .from('sms_sent')
      .select('id, message, created_at')
      .eq('user_id', user_id)
      .eq('phone_normalized', client_phone)
      .eq('is_sent', true)
      .order('created_at', { ascending: false })
      .limit(limit)

    // Inbound: sms_replies from this client to this barber
    const { data: replyRows } = await supabase
      .from('sms_replies')
      .select('id, message, received_at')
      .eq('user_id', user_id)
      .eq('phone_number', client_phone)
      .not('client_id', 'is', null)
      .order('received_at', { ascending: false })
      .limit(limit)

    const outbound: Message[] = (sentRows || []).map(r => ({
      id: `sent-${r.id}`,
      body: r.message + '\n\nReply STOP to unsubscribe.',
      direction: 'outbound',
      timestamp: r.created_at,
    }))

    const inbound: Message[] = (replyRows || []).map(r => ({
      id: `reply-${r.id}`,
      body: r.message,
      direction: 'inbound',
      timestamp: r.received_at,
    }))

    const merged = [...outbound, ...inbound]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    const visible = merged.slice(Math.max(0, merged.length - limit), merged.length)

    setTotal(merged.length)
    setMessages(visible)
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await fetchMessages(1)
      setLoading(false)
    }
    init()
  }, [user_id, client_phone])

  useEffect(() => {
    if (!loading) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [loading])

  const handleSeeMore = async () => {
    setLoadingMore(true)
    const nextPage = page + 1
    setPage(nextPage)
    await fetchMessages(nextPage)
    setLoadingMore(false)
  }

  const hasMore = messages.length < total

  const formatTime = (ts: string) => {
    const d = new Date(ts)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    const isYesterday = d.toDateString() === yesterday.toDateString()

    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    if (isToday) return time
    if (isYesterday) return `Yesterday ${time}`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` ${time}`
  }

  // Group messages by date for date separators
  const groupedMessages = messages.reduce<{ date: string; items: Message[] }[]>((acc, msg) => {
    const d = new Date(msg.timestamp)
    const label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    const last = acc[acc.length - 1]
    if (last && last.date === label) {
      last.items.push(msg)
    } else {
      acc.push({ date: label, items: [msg] })
    }
    return acc
  }, [])

  const initials = client_name
    .split(' ')
    .map(w => w[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('')

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="modal-backdrop flex items-end justify-center p-0 sm:items-center sm:p-4"
        onClick={onClose}
      >
        {/* Modal */}
        <motion.div
          key="modal"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          role="dialog"
          aria-modal="true"
          aria-label={`Message history with ${client_name}`}
          className="modal-surface flex w-full flex-col overflow-hidden rounded-b-none sm:max-w-sm sm:rounded-b-[0.875rem]"
          style={{ height: '80vh', maxHeight: '640px' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex flex-shrink-0 items-center gap-3 border-b border-white/[0.07] px-4 py-3">
            {/* Avatar */}
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-sage/15">
              <span className="text-sm font-semibold text-sage-bright">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="panel-title truncate">{client_name}</p>
              <p className="truncate text-xs tabular-nums text-muted">{client_phone}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="btn btn-ghost btn-sm h-8 w-8 flex-shrink-0 px-0"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>

          {/* Formatting note */}
          <div className="flex-shrink-0 border-b border-white/[0.07] bg-raised px-4 py-2">
            <p className="text-[11px] leading-relaxed text-gray-500">
              Messages may appear less formatted than what was actually sent. Spacing and line breaks look better in the real SMS.
            </p>
          </div>

          {/* Message thread */}
          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-1">

            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-gray-500" strokeWidth={1.75} />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-center text-sm text-muted">No messages yet.</p>
              </div>
            ) : (
              <>
                {/* See more */}
                {hasMore && (
                  <div className="flex justify-center mb-2">
                    <button
                      type="button"
                      onClick={handleSeeMore}
                      disabled={loadingMore}
                      className="btn btn-ghost btn-sm h-7 px-2.5 text-xs"
                    >
                      {loadingMore
                        ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.75} />
                        : <ChevronUp className="h-3 w-3" strokeWidth={1.75} />
                      }
                      See more
                    </button>
                  </div>
                )}

                {groupedMessages.map(group => (
                  <div key={group.date} className="flex flex-col gap-1">
                    {/* Date separator */}
                    <div className="flex items-center gap-2 my-2">
                      <div className="h-px flex-1 bg-white/[0.07]" />
                      <span className="flex-shrink-0 text-[11px] text-gray-500">{group.date}</span>
                      <div className="h-px flex-1 bg-white/[0.07]" />
                    </div>

                    {group.items.map((msg, i) => {
                      const isOutbound = msg.direction === 'outbound'
                      const prev = group.items[i - 1]
                      const next = group.items[i + 1]
                      const sameAsPrev = prev?.direction === msg.direction
                      const sameAsNext = next?.direction === msg.direction

                      // Bubble tail rounding: iOS-style grouping
                      const outboundRadius = `12px ${sameAsPrev ? '4px' : '12px'} ${sameAsNext ? '4px' : '12px'} 12px`
                      const inboundRadius  = `${sameAsPrev ? '4px' : '12px'} 12px 12px ${sameAsNext ? '4px' : '12px'}`

                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.15 }}
                          className={`flex flex-col ${isOutbound ? 'items-end' : 'items-start'} ${sameAsPrev ? 'mt-0.5' : 'mt-2'}`}
                        >
                          <div
                            className={`max-w-[78%] px-3.5 py-2 text-sm leading-relaxed ${
                              isOutbound
                                ? 'bg-sage text-ink'
                                : 'bg-raised text-ivory ring-1 ring-inset ring-white/[0.07]'
                            }`}
                            style={{ borderRadius: isOutbound ? outboundRadius : inboundRadius }}
                          >
                            {msg.body}
                          </div>
                          {/* Timestamp — only show on last in a group run */}
                          {!sameAsNext && (
                            <p className="mt-1 px-1 text-[11px] tabular-nums text-gray-500">{formatTime(msg.timestamp)}</p>
                          )}
                        </motion.div>
                      )
                    })}
                  </div>
                ))}

                <div ref={bottomRef} />
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}