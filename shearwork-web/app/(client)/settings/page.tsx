'use client'

import React, { useState, useRef, useEffect, Suspense } from 'react'
import { AnimatePresence, motion, Variants, easeInOut } from 'framer-motion'
import { useSearchParams, useRouter } from 'next/navigation'

import { Loader2, Menu, X, Settings } from 'lucide-react'
import { AppPage, PageHeader } from '@/components/ui/AppKit'
import SidebarTabs, { SETTINGS_TABS } from '@/components/Settings/SidebarTabs'
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
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: easeInOut },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: { duration: 0.15, ease: easeInOut },
  },
}

function SettingsPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="flex items-center gap-3 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin text-sage" strokeWidth={1.75} />
        Loading settings...
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
  const navbarRef = useRef<HTMLDivElement>(null)
  const [navbarHeight, setNavbarHeight] = useState(0)

  useEffect(() => {
    const shouldOpenCredits = searchParams.get('openCredits')
    if (shouldOpenCredits === 'true') {
      setTimeout(() => {
        setShowCreditsModal(true)
        router.replace('/settings')
      }, 0)
    }
  }, [searchParams, router])

  // ?code= (mobile app -> web login) is handled once, globally, by MobileAuthHandler

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

  const activeLabel = SETTINGS_TABS.find(t => t.id === activeTab)?.label ?? 'Profile'

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
              transition={{ type: 'tween', duration: 0.25 }}
              className="relative z-50 flex min-h-full w-64 flex-col border-r border-white/[0.07] bg-[#141614] px-3 py-4"
            >
              <div className="mb-4 flex items-center justify-between px-3">
                <span className="text-[15px] font-semibold text-ivory">Settings</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn btn-ghost btn-sm h-8 w-8 p-0"
                  aria-label="Close menu"
                >
                  <X className="h-[18px] w-[18px]" strokeWidth={1.75} />
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

      <AppPage>
        <div className="mx-auto max-w-6xl">
          <PageHeader icon={Settings} tone="sky"
            title={
              <span className="flex items-center gap-2">
                Settings
                <TutorialLauncher
                  pageKey="settings"
                  steps={SETTINGS_TUTORIAL_STEPS}
                  context={{ setActiveTab }}
                  renderTrigger={(openTutorial) => (
                    <TutorialInfoButton onClick={openTutorial} label="Settings tutorial" />
                  )}
                />
              </span>
            }
            subtitle="Manage your profile, billing, and integrations."
          />

          <div className="flex flex-col gap-4 lg:flex-row lg:gap-8">
            {/* Desktop nav */}
            <div data-tutorial-id="settings-tabs" className="hidden w-52 flex-shrink-0 lg:block">
              <SidebarTabs activeTab={activeTab} setActiveTab={setActiveTab} />
            </div>

            {/* Mobile menu button */}
            <div className="lg:hidden">
              <button onClick={() => setMobileMenuOpen(true)} className="btn btn-glass btn-sm">
                <Menu className="h-4 w-4" strokeWidth={1.75} />
                {activeLabel}
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
              className="min-w-0 flex-1"
            >
              <AnimatePresence mode="wait">{renderTab()}</AnimatePresence>
            </motion.div>
          </div>
        </div>
      </AppPage>

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