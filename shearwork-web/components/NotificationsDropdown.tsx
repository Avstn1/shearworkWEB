'use client'

import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { Bell } from 'lucide-react'
import { useRouter } from 'next/navigation'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { motion, AnimatePresence } from 'framer-motion'

dayjs.extend(relativeTime)

interface Notification {
  id: string
  header: string
  message: string
  is_read: boolean
  created_at: string
}

interface NotificationsDropdownProps {
  userId: string
}

export default function NotificationsDropdown({ userId }: NotificationsDropdownProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = async () => {
    if (!userId) return

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(15)

      if (error) console.error('Failed to fetch notifications:', error)

      // Map database 'read' column to 'is_read' for our interface
      const mapped = (data || []).map(item => ({
        id: item.id,
        header: item.header,
        message: item.message,
        is_read: item.read === true,
        created_at: item.timestamp
      }))

      setNotifications(mapped)
    } catch (err) {
      console.error(err)
    }
  }

  // Fetch on mount + on userId change
  useEffect(() => {
    if (userId) fetchNotifications()
  }, [userId])

  // 🔥 Realtime listener
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
          const newN = payload.new as any

          const formatted: Notification = {
            id: newN.id,
            header: newN.header,
            message: newN.message,
            is_read: newN.read === true,
            created_at: newN.timestamp,
          }

          setNotifications((prev) => [formatted, ...prev])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

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
    // Only update if it's currently unread
    if (!n.is_read) {
      await supabase.from('notifications').update({ read: true }).eq('id', n.id)
      // Optimistically update the UI
      setNotifications((prev) => 
        prev.map((notif) => notif.id === n.id ? { ...notif, is_read: true } : notif)
      )
    }
  }

  const handleMarkAllRead = async () => {
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon */}
      <button
        className="relative p-2 rounded-full hover:bg-[rgba(255,255,255,0.1)] transition-colors"
        onClick={() => setOpen(!open)}
      >
        <Bell className="w-6 h-6 text-[var(--foreground)]" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-[var(--highlight)] text-black text-[0.625rem] font-bold w-5 h-5 flex items-center justify-center rounded-full animate-pulse shadow-sm">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-96 max-w-[90vw] bg-[var(--accent-1)] border border-[var(--accent-2)] rounded-2xl shadow-lg z-50 overflow-hidden backdrop-blur-sm"
          >
            <div className="flex justify-between items-center p-4 border-b border-[var(--accent-2)]">
              <h3 className="font-semibold text-[var(--highlight)] text-sm tracking-wide">Notifications</h3>
              <button
                onClick={handleMarkAllRead}
                className="text-[var(--accent-2)] hover:text-[var(--highlight)] text-xs transition-colors"
              >
                Mark all read
              </button>
            </div>

            {notifications.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">No notifications</div>
            ) : (
              <div className="max-h-80 overflow-y-auto scrollbar-none">
                {notifications.map((n) => (
                  <motion.div
                    key={n.id}
                    onClick={() => handleClickNotification(n)}
                    className={`px-4 py-3 cursor-pointer transition flex flex-col gap-1 rounded-lg mb-1
                      ${!n.is_read ? 'bg-[rgba(255,255,255,0.08)] font-semibold' : 'hover:bg-[rgba(255,255,255,0.05)]'}
                    `}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className="text-sm text-white">{n.header}</span>
                    <span className="text-xs text-gray-400">{n.message}</span>
                    <span className="text-[0.65rem] text-gray-500">{dayjs(n.created_at).fromNow()}</span>
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