'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/utils/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { 
  Grid, 
  UserCog, 
  Calendar, 
  CreditCard, 
  Megaphone,
  Coins,
  TrendingUp
} from 'lucide-react'
import NewFeaturesModal from '@/components/Dashboard/NewFeaturesModal'

export default function Sidebar() {
  const { user, profile } = useAuth()
  const [hasSession, setHasSession] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [hasUnreadFeatures, setHasUnreadFeatures] = useState(false)
  const [showFeaturesModal, setShowFeaturesModal] = useState(false)
  const [specialAccess, setSpecialAccess] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setHasSession(!!user)
    setUserId(user?.id || null)
    setSpecialAccess(Boolean(profile?.special_access))

    if (user?.id && profile) {
      checkUnreadFeatures(profile?.last_read_feature_updates)
    } else {
      setHasUnreadFeatures(false)
    }

    // Set CSS variable for main content offset: hidden on mobile, icon rail on
    // tablets, labelled sidebar on desktop
    const updateSidebarWidth = () => {
      const w = window.innerWidth
      document.documentElement.style.setProperty(
        '--sidebar-width',
        w < 768 ? '0px' : w < 1024 ? '72px' : '224px'
      )
    }
    
    updateSidebarWidth()
    window.addEventListener('resize', updateSidebarWidth)
    
    return () => window.removeEventListener('resize', updateSidebarWidth)
  }, [user?.id, profile?.special_access, profile?.last_read_feature_updates])

  const checkUnreadFeatures = async (lastRead?: string | null) => {
    try {
      const { data: latestFeature, error: featureError } = await supabase
        .from('feature_updates')
        .select('updated_at')
        .eq('is_published', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      if (featureError && featureError.code !== 'PGRST116') throw featureError

      if (!latestFeature) {
        setHasUnreadFeatures(false)
        return
      }

      const latestUpdate = latestFeature.updated_at

      const hasUnread = !lastRead || new Date(lastRead) < new Date(latestUpdate)
      setHasUnreadFeatures(hasUnread)
      
    } catch (error) {
      console.error('Error checking unread features:', error)
    }
  }

  if (!hasSession) return null

  // const navItems = [
  //   { href: '/dashboard', icon: Grid, label: 'Dashboard' },
  //   { href: '/analytics', icon: TrendingUp, label: 'Analytics' },
  //   { href: '/client-manager', icon: UserCog, label: 'Client Manager' },
  //   { href: '/appointment-manager', icon: Calendar, label: 'Appointments' },
  //   { href: '/expenses', icon: CreditCard, label: 'Expenses' },
  // ]

  const navItems = [
    { href: '/dashboard', icon: Grid, label: 'Dashboard' },
    { href: '/analytics', icon: TrendingUp, label: 'Analytics' },
    { href: '/client-manager', icon: UserCog, label: 'Client Manager' },
    { href: '/appointment-manager', icon: Calendar, label: 'Appointments' },
    { href: '/expenses', icon: CreditCard, label: 'Expenses' },
  ]

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <>
      <aside
        className="fixed left-0 z-40 hidden w-[var(--sidebar-width,224px)] flex-col border-r border-white/[0.07] bg-[#141614] md:flex"
        style={{ top: 'var(--navbar-height, 72px)', height: 'calc(100dvh - var(--navbar-height, 72px))' }}
      >
        <nav className="flex-1 space-y-0.5 px-3 py-4" aria-label="Main">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-current={active ? 'page' : undefined}
                className={`relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors md:justify-center lg:justify-start ${
                  active ? 'bg-[rgb(140_196_112/0.12)] text-ivory' : 'text-gray-400 hover:bg-white/[0.04] hover:text-ivory'
                }`}
              >
                {active && <span className="absolute -left-3 top-2 bottom-2 w-0.5 rounded-r bg-sage" />}
                <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-sage-bright' : ''}`} strokeWidth={1.75} />
                <span className="hidden truncate lg:inline">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="space-y-3 border-t border-white/[0.07] px-3 py-4">
          <button
            type="button"
            title="Feature updates"
            onClick={() => {
              setShowFeaturesModal(true)
              setHasUnreadFeatures(false)
            }}
            className="relative flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-gray-400 transition-colors hover:bg-white/[0.04] hover:text-ivory md:justify-center lg:justify-start"
          >
            <Megaphone className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
            <span className="hidden lg:inline">Feature updates</span>
            {hasUnreadFeatures && (
              <span className="absolute right-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-sage md:right-2 md:top-2 md:translate-y-0 lg:right-3 lg:top-1/2 lg:-translate-y-1/2" />
            )}
          </button>
          <p className="hidden px-3 text-[11px] text-gray-500 lg:block">
            © {new Date().getFullYear()} Corva ·{' '}
            <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-300">
              Privacy
            </a>
          </p>
        </div>
      </aside>

      <NewFeaturesModal
        isOpen={showFeaturesModal}
        onClose={() => setShowFeaturesModal(false)}
        initialViewMode="barberView"
        userId={userId || undefined}
      />
    </>
  )
}
