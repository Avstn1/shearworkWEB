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
  Coins
} from 'lucide-react'
import NewFeaturesModal from '@/components/Dashboard/NewFeaturesModal'

const COLORS = {
  green: '#73aa57',
  surfaceSolid: 'rgba(255, 255, 255, 0.1)',
  text: '#e5e5e5',
  navBg: '#1b1d1b',
}

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

    // Set CSS variable for main content offset
    const updateSidebarWidth = () => {
      const isMobile = window.innerWidth < 768 // md breakpoint
      document.documentElement.style.setProperty(
        '--sidebar-width',
        isMobile ? '0px' : '80px'
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
      
      // Auto-open modal if there are unread features
      if (hasUnread) {
        setShowFeaturesModal(true)
      }
    } catch (error) {
      console.error('Error checking unread features:', error)
    }
  }

  if (!hasSession) return null

  const navItems = [
    { href: '/dashboard', icon: Grid, label: 'Dashboard' },
    { href: '/client-manager', icon: UserCog, label: 'Client Manager' },
    { href: '/appointment-manager', icon: Calendar, label: 'Appointments' },
    { href: '/expenses', icon: CreditCard, label: 'Expenses' },
  ]

  const isActive = (href: string) => pathname === href

  return (
    <>
      <div
        className="fixed left-0 top-0 h-screen z-40 hidden md:block group"
        onMouseEnter={(e) => {
          e.currentTarget.style.width = '240px'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.width = '80px'
        }}
        style={{
          width: '80px',
          background: 'linear-gradient(180deg, rgba(27, 29, 27, 0.98) 0%, rgba(24, 24, 24, 0.98) 100%)',
          backdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(115, 170, 87, 0.15)',
          boxShadow: '4px 0 24px rgba(0, 0, 0, 0.2)',
          paddingTop: '80px', // Offset for navbar
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Content */}
        <div className="flex flex-col h-full py-6">
          {/* Feature Updates (Gavin only) */}
          <div className="px-3 mb-6 flex justify-center">
            <button
              onClick={() => {
                setShowFeaturesModal(true)
                setHasUnreadFeatures(false)
              }}
              className="relative w-full rounded-lg font-semibold text-sm transition-all overflow-hidden"
              style={{
                background: hasUnreadFeatures 
                  ? 'linear-gradient(135deg, #73aa57 0%, #5b8f52 100%)'
                  : 'rgba(115, 170, 87, 0.15)',
                color: hasUnreadFeatures ? '#000000' : COLORS.green,
                border: `1.5px solid ${hasUnreadFeatures ? 'transparent' : COLORS.green}`,
                boxShadow: hasUnreadFeatures ? '0 0 20px rgba(115, 170, 87, 0.4)' : 'none',
                padding: '12px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.02)'
                e.currentTarget.style.boxShadow = hasUnreadFeatures 
                  ? '0 0 25px rgba(115, 170, 87, 0.6)' 
                  : '0 0 10px rgba(115, 170, 87, 0.3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.boxShadow = hasUnreadFeatures 
                  ? '0 0 20px rgba(115, 170, 87, 0.4)' 
                  : 'none'
              }}
            >
              {hasUnreadFeatures && (
                <span 
                  className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-pulse"
                  style={{ backgroundColor: '#ff4444' }}
                />
              )}
              <div className="group-hover:hidden flex justify-center">
                <Megaphone className="w-5 h-5" />
              </div>
              <div 
                className="hidden group-hover:flex items-center gap-2"
                style={{
                  transition: 'opacity 0.15s ease-in-out 0.15s',
                }}
              >
                <Megaphone className="w-5 h-5 flex-shrink-0" />
                <span className="whitespace-nowrap">Feature Updates</span>
              </div>
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 px-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block"
                >
                  <div
                    className="relative flex items-center gap-3 rounded-lg transition-all duration-200"
                    style={{
                      padding: '12px',
                      backgroundColor: active 
                        ? 'rgba(115, 170, 87, 0.15)' 
                        : 'transparent',
                      color: active ? COLORS.green : COLORS.text,
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }
                    }}
                  >
                    {/* Active indicator */}
                    {active && (
                      <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full"
                        style={{ backgroundColor: COLORS.green }}
                      />
                    )}
                    
                    <div className="group-hover:hidden flex justify-center w-full">
                      <Icon 
                        className="w-5 h-5 transition-transform hover:scale-110"
                        style={{ 
                          color: active ? COLORS.green : COLORS.text,
                        }}
                      />
                    </div>
                    
                    <div className="hidden group-hover:flex items-center gap-3 w-full">
                      <Icon 
                        className="w-5 h-5 transition-transform hover:scale-110 flex-shrink-0"
                        style={{ 
                          color: active ? COLORS.green : COLORS.text,
                        }}
                      />
                      <span 
                        className="font-medium text-sm whitespace-nowrap overflow-hidden"
                        style={{
                          transition: 'opacity 0.15s ease-in-out 0.15s',
                        }}
                      >
                        {item.label}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="px-3 pt-4 border-t border-white/10 flex justify-center">
            <div className="text-xs text-white/40 text-center group-hover:hidden">
              ©
            </div>
            <div className="text-xs text-white/40 text-center hidden group-hover:block">
              © {new Date().getFullYear()} Corva
            </div>
          </div>
        </div>
      </div>

      <NewFeaturesModal
        isOpen={showFeaturesModal}
        onClose={() => setShowFeaturesModal(false)}
        initialViewMode="barberView"
        userId={userId || undefined}
      />
    </>
  )
}
