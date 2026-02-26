'use client'

import React, { useState, useRef, useEffect, Suspense } from 'react'
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
import SquareTab from '@/components/Settings/SquareTab'
import TutorialLauncher from '@/components/Tutorial/TutorialLauncher'
import TutorialInfoButton from '@/components/Tutorial/TutorialInfoButton'
import { SETTINGS_TUTORIAL_STEPS } from '@/lib/tutorials/settings'

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

function SettingsPageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#101312] via-[#1a1f1b] to-[#2e3b2b]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-300 mx-auto mb-4"></div>
        <p className="text-gray-300">Loading settings...</p>
      </div>
    </div>
  )
}

function SettingsPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState('profile')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showCreditsModal, setShowCreditsModal] = useState(false)
  const [authenticating, setAuthenticating] = useState(false)
  const navbarRef = useRef<HTMLDivElement>(null)
  const [navbarHeight, setNavbarHeight] = useState(0)
  const hasProcessedCode = useRef(false)

  useEffect(() => {
    const shouldOpenCredits = searchParams.get('openCredits')
    if (shouldOpenCredits === 'true') {
      setTimeout(() => {
        setShowCreditsModal(true)
        router.replace('/settings')
      }, 0)
    }
  }, [searchParams, router])

  useEffect(() => {
    const authenticateUser = async () => {
      const code = searchParams.get('code')
      if (!code) return

      try {
        console.log('Starting auth with code:', code)

        const response = await fetch('/api/mobile-web-redirect/verify-web-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code })
        })

        console.log('Response status:', response.status)
        const data = await response.json()
        console.log('Response data:', data)

        if (!response.ok || !data.access_token) {
          console.log('Auth failed - invalid response')
          toast.error(data.error || 'Invalid or expired code. Please try again from the app.')
          setAuthenticating(false)
          router.push('/login')
          return
        }

        supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token
        })

        toast.success('Successfully authenticated!')

        setTimeout(() => {
          globalThis.location.href = '/settings?openCredits=true'
        }, 500)

      } catch (err: any) {
        console.error('Auth error:', err)
        toast.error('Authentication failed')
        setAuthenticating(false)
        router.push('/login')
      }
    }

    authenticateUser()
  }, [searchParams, router])

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
      case 'square':
        return <SquareTab />
      case 'billing':
        return <BillingSection />
      case 'security':
        return <SecurityTab setActiveTab={setActiveTab} />
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
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
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
        style={{ paddingTop: 'calc(80px + 1.5rem)' }}
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
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">Settings</h1>
              <TutorialLauncher
                pageKey="settings"
                steps={SETTINGS_TUTORIAL_STEPS}
                context={{ setActiveTab }}
                renderTrigger={(openTutorial) => (
                  <TutorialInfoButton onClick={openTutorial} label="Settings tutorial" />
                )}
              />
            </div>
            <p className="text-xs text-[#bdbdbd]">Manage your profile, billing, and integrations.</p>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Desktop Sidebar */}
            <div data-tutorial-id="settings-tabs" className="hidden lg:flex w-64 flex-shrink-0">
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
              data-tutorial-id={`settings-tab-${activeTab}`}
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

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsPageLoader />}>
      <SettingsPageContent />
    </Suspense>
  )
}