'use client'

import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { Bell, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '@/contexts/AppContext'

dayjs.extend(relativeTime)

interface Notification {
  id: string
  header: string
  message: string
  is_read: boolean
  created_at: string
  reference?: string
  reference_type?: string
}

interface NotificationsDropdownProps {
  userId: string
}

export default function NotificationsDropdown({ userId }: NotificationsDropdownProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { openReport, triggerRefresh } = useApp()
  const router = useRouter()

  const fetchNotifications = async () => {
    if (!userId) return

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('show', true)
      .order('timestamp', { ascending: false })
      .limit(15)

    const mapped = (data || []).map((n: any) => ({
      id: n.id,
      header: n.header,
      message: n.message,
      is_read: n.read === true,
      created_at: n.timestamp,
      reference: n.reference,
      reference_type: n.reference_type,
    }))

    setNotifications(mapped)
  }

  useEffect(() => {
    fetchNotifications()
  }, [userId])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as any

          setNotifications((prev) => [
            {
              id: n.id,
              header: n.header,
              message: n.message,
              is_read: n.read === true,
              created_at: n.timestamp,
              reference: n.reference,
              reference_type: n.reference_type,
            },
            ...prev,
          ])

          triggerRefresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, triggerRefresh])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const handleClickNotification = async (n: Notification) => {
    if (!n.is_read) {
      await supabase.from('notifications').update({ read: true }).eq('id', n.id)
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x))
      )
    }

    if (n.reference && n.reference_type) {
      triggerRefresh()
      setOpen(false)

      if (!window.location.pathname.includes('/dashboard')) {
        router.push('/dashboard')
        setTimeout(() => openReport(n.reference!, n.reference_type!), 1200)
      } else {
        setTimeout(() => openReport(n.reference!, n.reference_type!), 300)
      }
    }
  }

  const handleMarkAllRead = async () => {
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
        aria-expanded={open}
        className={`btn btn-ghost btn-sm relative h-9 w-9 !px-0 ${open ? '!bg-white/[0.06] !text-ivory' : ''}`}
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-sage px-1 text-[10px] font-semibold leading-none text-ink tabular-nums ring-2 ring-canvas">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="modal-surface fixed md:absolute right-4 md:right-0 top-16 md:top-full md:mt-2 w-[calc(100vw-2rem)] md:w-96 z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-ivory">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="badge badge-sage tabular-nums">{unreadCount} new</span>
                )}
              </div>
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="btn btn-ghost btn-sm h-8 !px-2.5 text-xs"
              >
                <Check className="h-3.5 w-3.5" strokeWidth={1.75} />
                Mark all read
              </button>
            </div>

            {/* Content */}
            {notifications.length === 0 ? (
              <div className="empty-state py-10">
                <Bell strokeWidth={1.75} />
                <span>No notifications</span>
              </div>
            ) : (
              <ul className="max-h-96 overflow-y-auto divide-y divide-white/[0.06]">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleClickNotification(n)}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${n.is_read ? 'bg-transparent' : 'bg-sage'}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm ${n.is_read ? 'font-medium text-gray-300' : 'font-semibold text-ivory'}`}>
                          {n.header}
                        </span>
                        <span className="mt-0.5 block text-[13px] leading-snug text-gray-400">
                          {n.message}
                        </span>
                        <span className="mt-1 block text-xs text-gray-500">
                          {dayjs(n.created_at).fromNow()}
                        </span>
                      </span>
                      {!n.is_read && <span className="sr-only">Unread</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
