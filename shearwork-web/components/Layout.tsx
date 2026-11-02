'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, Menu, Scissors, X } from 'lucide-react'
import SignOutButton from '@/components/SignOutButton'
import { useAuth } from '@/contexts/AuthContext'

const navLinksBase = [
  { href: '/dashboard', label: 'Dashboard' },
]

// SignOutButton ships its own colours; these override them to match the outline (.btn-glass) look
const SIGN_OUT_CLASSES =
  'w-full h-10 !rounded-lg !bg-transparent !text-ivory !shadow-none border border-white/[0.12] text-sm !font-medium hover:!bg-white/[0.05]'

function Brand() {
  return (
    <span className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-ivory">
      <Scissors className="h-[18px] w-[18px] text-sage" strokeWidth={1.75} />
      Corva
    </span>
  )
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const { isLoading, isAdmin } = useAuth()

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Page access (including onboarding) is enforced by proxy.ts + LayoutWrapper

  const navLinks = isAdmin
    ? navLinksBase.filter(link => link.href !== '/dashboard').concat({
        href: '/admin/dashboard',
        label: 'Admin Dashboard',
      })
    : navLinksBase

  if (isLoading) {
    return <p className="p-6 text-sm text-gray-400">Loading components/layout...</p>
  }

  const renderLink = (link: { href: string; label: string }, onClick?: () => void) => {
    const active = pathname === link.href
    return (
      <Link
        key={link.href}
        href={link.href}
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        className={`relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
          active ? 'bg-white/[0.06] text-ivory' : 'text-gray-400 hover:bg-white/[0.04] hover:text-ivory'
        }`}
      >
        {active && <span className="absolute -left-3 top-2 bottom-2 w-0.5 rounded-r bg-sage" />}
        <LayoutGrid className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-sage-bright' : ''}`} strokeWidth={1.75} />
        <span className="truncate">{link.label}</span>
      </Link>
    )
  }

  return (
    <div className="flex flex-col sm:flex-row min-h-screen bg-canvas text-ivory">
      {/* Sidebar for desktop */}
      {!isMobile && (
        <aside className="flex w-60 shrink-0 flex-col border-r border-white/[0.07] bg-[#141614]">
          <Link href="/" className="flex h-16 items-center border-b border-white/[0.07] px-5">
            <Brand />
          </Link>
          <nav className="flex flex-col space-y-0.5 px-3 py-4" aria-label="Main">
            {navLinks.map((link) => renderLink(link))}
          </nav>
          <div className="mt-auto border-t border-white/[0.07] p-3">
            <SignOutButton className={SIGN_OUT_CLASSES} />
          </div>
        </aside>
      )}

      {/* Mobile Top Bar */}
      {isMobile && (
        <header className="flex h-16 w-full flex-shrink-0 items-center justify-between border-b border-white/[0.07] bg-canvas px-4">
          <Brand />
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="btn btn-ghost btn-sm h-9 w-9 !px-0"
          >
            <Menu className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
        </header>
      )}

      {/* Mobile menu overlay */}
      {isMobile && mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-sm">
          <div className="flex h-16 items-center justify-between border-b border-white/[0.07] bg-[#141614] px-4">
            <Brand />
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileMenuOpen(false)}
              className="btn btn-ghost btn-sm h-9 w-9 !px-0"
            >
              <X className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </button>
          </div>
          <nav className="flex flex-1 flex-col space-y-0.5 overflow-hidden bg-[#141614] px-3 py-4" aria-label="Main">
            {navLinks.map((link) => renderLink(link, () => setMobileMenuOpen(false)))}
            <div className="mt-auto border-t border-white/[0.07] pt-3">
              <SignOutButton className={SIGN_OUT_CLASSES} />
            </div>
          </nav>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 w-full p-3 sm:p-6 flex flex-col min-h-0 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
