'use client'

import React, { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion, Variants, easeInOut } from 'framer-motion'
import { useSearchParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { supabase } from '@/utils/supabaseClient'

import Navbar from '@/components/Navbar'
import SidebarTabs from '@/components/Settings/SidebarTabs'
import ProfileTab from '@/components/Settings/ProfileTab'
import AcuityTab from '@/components/Settings/AcuityTab'
import SecurityTab from '@/components/Settings/SecurityTab'
import LogoutTab from '@/components/Settings/LogoutTab'
import BillingSection from '@/components/Settings/BillingSection'
import CreditsModal from '@/components/Dashboard/CreditsModal'

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: easeInOut },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: { duration: 0.3, ease: easeInOut },
  },
}

export default function SettingsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const [activeTab, setActiveTab] = useState('profile')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showCreditsModal, setShowCreditsModal] = useState(false)
  const [authenticating, setAuthenticating] = useState(false)
  const navbarRef = useRef<HTMLDivElement>(null)
  const [navbarHeight, setNavbarHeight] = useState(0)

  // Handle authentication from mobile app code
  useEffect(() => {
    const authenticateUser = async () => {
      const code = searchParams.get('code')
      if (!code) return
      
      setAuthenticating(true)
      
      try {
        const response = await fetch('/api/mobile-web-redirect/verify-web-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code })
        })

        const data = await response.json()
        
        if (!response.ok || !data.access_token) {
          toast.error(data.error || 'Invalid or expired code. Please try again from the app.')
          router.push('/login')
          return
        }

        // Set session with the tokens from the verified code
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token
        })

        if (sessionError) {
          console.error('Session error:', sessionError)
          throw sessionError
        }
        
        toast.success('Successfully authenticated!')
        
        // Clean URL - remove the code parameter
        router.replace('/settings')
        
        // Open credits modal after authentication
        setTimeout(() => {
          setShowCreditsModal(true)
        }, 500)
        
      } catch (err: any) {
        console.error('Auth error:', err)
        toast.error('Authentication failed')
        router.push('/login')
      } finally {
        setAuthenticating(false)
      }
    }

    authenticateUser()
  }, [searchParams, router])

  // Measure navbar height for padding
  useEffect(() => {
    if (navbarRef.current) {
      const height = navbarRef.current.offsetHeight
      setNavbarHeight(height)
      document.documentElement.style.setProperty('--navbar-height', `${height}px`)
    }
  }, [])

  const renderTab = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileTab />
      case 'acuity':
        return <AcuityTab />
      case 'billing':
        return <BillingSection/>
      case 'security':
        return <SecurityTab />
      case 'logout':
        return <LogoutTab />
      default:
        return <ProfileTab />
    }
  }

  return (
    <>
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* overlay */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            {/* slide-over sidebar */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="relative w-64 bg-[#1a1f1b] border-r border-white/10 p-6 shadow-2xl z-50 flex flex-col min-h-full"
            >
              <div className="flex justify-between items-center mb-6">
                <span className="text-lime-300 text-2xl font-bold">Settings</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-gray-400 hover:text-white text-xl transition-colors"
                >
                  ✕
                </button>
              </div>
              <SidebarTabs
                activeTab={activeTab}
                setActiveTab={(tab) => {
                  setActiveTab(tab)
                  setMobileMenuOpen(false)
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page Content */}
      <div
        className="min-h-screen px-4 py-6 md:px-8 md:py-8 bg-gradient-to-br from-[#101312] via-[#1a1f1b] to-[#2e3b2b] text-white"
        style={{ paddingTop: 'calc(80px + 1.5rem)' }} // Navbar height + spacing
      >
        {authenticating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-300 mx-auto mb-4"></div>
              <p className="text-gray-300">Authenticating...</p>
            </div>
          </div>
        )}
        
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Desktop Sidebar */}
            <div className="hidden lg:flex w-64 flex-shrink-0">
              <SidebarTabs activeTab={activeTab} setActiveTab={setActiveTab} />
            </div>

            {/* Mobile Menu Button */}
            <div className="flex lg:hidden">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="px-6 py-2.5 bg-gradient-to-r from-lime-400 to-emerald-400 text-black rounded-full font-semibold shadow-lg hover:shadow-lime-400/20 transition-all"
              >
                Menu
              </button>
            </div>

            {/* Main Content */}
            <motion.div
              key={activeTab}
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8 shadow-xl min-h-[600px]"
            >
              <AnimatePresence mode="wait">{renderTab()}</AnimatePresence>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Credits Modal */}
      <CreditsModal
        isOpen={showCreditsModal}
        onClose={() => setShowCreditsModal(false)}
      />
    </>
  )
}