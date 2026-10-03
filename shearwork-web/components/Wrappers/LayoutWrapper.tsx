'use client'

import { ReactNode, Suspense, useEffect, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/contexts/AuthContext'
import MobileAuthHandler from './MobileAuthHandler'
import TrialPromptModal from '@/components/Dashboard/TrialPromptModal'
import { isPublicPath, resolveRedirect } from '@/lib/auth/routing'

function LayoutWrapperContent({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const {
    user,
    profile,
    isAdmin,
    isPremiumUser,
    isLoading,
    profileStatus,
    trialPromptMode,
    trialDaysRemaining,
  } = useAuth()

  // Pages that render without waiting for the profile (public pages + the pricing flow)
  const isPublicRoute = isPublicPath(pathname) || pathname.startsWith('/pricing')

  // Show strong prompt modal when trial has ended (Day 21+). Not on the pricing flow,
  // which is where the modal sends them to add a card.
  const showStrongPrompt = useMemo(() => {
    return trialPromptMode === 'strong' && !isPublicRoute && !isAdmin
  }, [trialPromptMode, isPublicRoute, isAdmin])

  // Fallback handler - modal now handles checkout internally
  const handleAddCard = () => {
    router.push('/pricing')
  }

  // Same rules as proxy.ts, re-applied on client-side navigations and after the
  // profile changes (e.g. onboarding finished, trial started).
  useEffect(() => {
    if (isLoading) return
    if (user && profileStatus !== 'ready') return

    const redirectTo = resolveRedirect({
      pathname,
      search: globalThis.location?.search ?? '',
      isLoggedIn: Boolean(user),
      profile,
    })
    if (redirectTo && redirectTo !== pathname) {
      router.replace(redirectTo)
    }
  }, [isLoading, user, profile, profileStatus, pathname, router])

  // Show loading only for protected routes
  if ((isLoading || (user && profileStatus === 'loading')) && !isPublicRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#101312] via-[#1a1f1b] to-[#2e3b2b]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#73aa57] mb-4"></div>
          <p className="text-sm text-[#bdbdbd]">Loading profile...</p>
        </div>
      </div>
    )
  }

  if (user && profileStatus === 'error' && !isPublicRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#101312] via-[#1a1f1b] to-[#2e3b2b]">
        <div className="text-center max-w-md px-6">
          <h2 className="text-lg font-semibold text-white">We couldn&apos;t load your profile</h2>
          <p className="mt-2 text-sm text-[#bdbdbd]">
            Please refresh the page. If this keeps happening, try logging out and back in.
          </p>
          <button
            onClick={() => {
              globalThis.location.reload()
            }}
            className="mt-4 inline-flex items-center justify-center px-4 py-2 rounded-xl bg-gradient-to-r from-[#7affc9] to-[#3af1f7] text-black text-sm font-semibold"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }

  if (!user && !isPublicRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#101312] via-[#1a1f1b] to-[#2e3b2b]">
        <div className="text-center max-w-md px-6">
          <h2 className="text-lg font-semibold text-white">Session expired</h2>
          <p className="mt-2 text-sm text-[#bdbdbd]">
            Please log in again to continue.
          </p>
          <button
            onClick={() => {
              globalThis.location.href = '/login'
            }}
            className="mt-4 inline-flex items-center justify-center px-4 py-2 rounded-xl bg-gradient-to-r from-[#7affc9] to-[#3af1f7] text-black text-sm font-semibold"
          >
            Go to login
          </button>
        </div>
      </div>
    )
  }

  const showSidebar = user && !isAdmin && isPremiumUser && pathname !== '/pricing/return'

  return (
    <>
      {/* Mobile auth code safely handled in Suspense */}
      <Suspense fallback={null}>
        <MobileAuthHandler />
      </Suspense>

      {/* Strong prompt modal - blocking, no dismiss */}
      <TrialPromptModal
        isOpen={showStrongPrompt}
        mode="strong"
        daysRemaining={trialDaysRemaining}
        onAddCard={handleAddCard}
      />

      {showSidebar && <Sidebar />}

      <div
        className={`min-h-screen transition-all duration-300 ${
          showSidebar ? 'md:ml-[var(--sidebar-width,0px)] md:w-[calc(100%-var(--sidebar-width,0px))]' : ''
        }`}
      >
        {children}
      </div>
    </>
  )
}

export default function LayoutWrapper({ children }: { children: ReactNode }) {
  return <LayoutWrapperContent>{children}</LayoutWrapperContent>
}