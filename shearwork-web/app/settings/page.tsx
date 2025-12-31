'use client'

import React, { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion, Variants, easeInOut } from 'framer-motion'

import Navbar from '@/components/Navbar'
import SidebarTabs from '@/components/Settings/SidebarTabs'
import ProfileTab from '@/components/Settings/ProfileTab'
import AcuityTab from '@/components/Settings/AcuityTab'
import SecurityTab from '@/components/Settings/SecurityTab'
import LogoutTab from '@/components/Settings/LogoutTab'
import BillingSection from '@/components/Settings/BillingSection'

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
  const [activeTab, setActiveTab] = useState('profile')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navbarRef = useRef<HTMLDivElement>(null)
  const [navbarHeight, setNavbarHeight] = useState(0)

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
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            {/* slide-over sidebar */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="relative w-64 bg-[var(--card-bg)] p-4 rounded-r-2xl shadow-xl z-50 flex flex-col min-h-full"
            >
              <div className="flex justify-between items-center mb-6">
                <span className="text-[var(--highlight)] text-2xl font-bold">Settings</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-[var(--text-bright)] text-xl"
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
        className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-[#101312] via-[#1a1f1b] to-[#2e3b2b] text-[var(--foreground)]"
        style={{ paddingTop: '100px' }} // <-- fixed padding to avoid overlap
      >
        <div className="flex flex-col md:flex-row gap-6 md:gap-8">
          {/* Desktop Sidebar */}
          <div className="hidden md:flex w-52 flex-shrink-0">
            <SidebarTabs activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden mb-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="px-4 py-2 bg-[var(--highlight)] text-black rounded-full font-semibold shadow-md"
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
            className="flex-1 bg-white/10 backdrop-blur-lg border border-white/10 rounded-2xl p-6 md:p-8 shadow-xl min-h-[500px]"
          >
            <AnimatePresence mode="wait">{renderTab()}</AnimatePresence>
          </motion.div>
        </div>
      </div>
    </>
  )
}
