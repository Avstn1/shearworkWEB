'use client'

import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { Bell } from 'lucide-react'
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
  const { openReport, triggerRefresh } = useApp()  // ADD triggerRefresh
  const router = useRouter()

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

      const mapped = (data || []).map(item => ({
        id: item.id,
        header: item.header,
        message: item.message,
        is_read: item.read === true,
        created_at: item.timestamp,
        reference: item.reference,
        reference_type: item.reference_type
      }))

      setNotifications(mapped)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    if (userId) fetchNotifications()
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
          const newN = payload.new as any

          const formatted: Notification = {
            id: newN.id,
            header: newN.header,
            message: newN.message,
            is_read: newN.read === true,
            created_at: newN.timestamp,
            reference: newN.reference,
            reference_type: newN.reference_type
          }

          setNotifications((prev) => [formatted, ...prev])
          
          // TRIGGER REFRESH when new notification arrives
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
    // Mark as read if unread
    if (!n.is_read) {
      await supabase.from('notifications').update({ read: true }).eq('id', n.id)
      setNotifications((prev) => 
        prev.map((notif) => notif.id === n.id ? { ...notif, is_read: true } : notif)
      )
    }

    // If notification has a reference, open the report
    if (n.reference && n.reference_type) {
      // Trigger refresh before opening
      triggerRefresh()
      
      setOpen(false)
      
      // Redirect to dashboard first if not already there
      if (!window.location.pathname.includes('/dashboard')) {
        router.push('/dashboard')
        setTimeout(() => {
          openReport(n.reference!, n.reference_type!)
        }, 1250)
      } else {
        setTimeout(() => {
          openReport(n.reference!, n.reference_type!)
        }, 300)
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

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute mt-2 bg-[var(--accent-1)] border border-[var(--accent-2)] rounded-2xl shadow-lg z-50 overflow-hidden backdrop-blur-sm
            right-0 w-96 max-w-[calc(100vw-1rem)]
            max-[640px]:fixed max-[640px]:left-[0.5rem] max-[640px]:right-[0.5rem] max-[640px]:w-auto"
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