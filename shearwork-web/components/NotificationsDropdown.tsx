'use client'

import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { Bell, Check, Calendar } from 'lucide-react'
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
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-full hover:bg-white/10 transition"
      >
        <Bell className="w-6 h-6 text-white" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-lime-300 text-black text-[10px] font-bold flex items-center justify-center shadow-[0_0_8px_#c4ff85]">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="fixed md:absolute right-4 md:right-0 top-16 md:top-auto md:mt-2 w-[calc(100vw-2rem)] md:w-96
              bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-sm font-semibold text-lime-300">
                Notifications
              </h3>
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-[#bdbdbd] hover:text-lime-300 transition"
              >
                Mark all read
              </button>
            </div>

            {/* Content */}
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-[#bdbdbd]">
                No notifications
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {notifications.map((n, i) => (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => handleClickNotification(n)}
                    className={`mx-2 my-1 rounded-xl p-3 cursor-pointer transition
                      ${
                        n.is_read
                          ? 'hover:bg-white/5'
                          : 'bg-lime-300/10 border border-lime-300/20'
                      }`}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white">
                          {n.header}
                        </p>
                        <p className="text-xs text-[#bdbdbd] mt-0.5">
                          {n.message}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-[#8a8a8a]">
                          <Calendar className="w-3 h-3" />
                          {dayjs(n.created_at).fromNow()}
                        </div>
                      </div>

                      {!n.is_read && (
                        <Check className="w-4 h-4 text-lime-300 mt-0.5" />
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}