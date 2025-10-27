'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import SignOutButton from '@/components/SignOutButton'
import { supabase } from '@/utils/supabaseClient'
import { motion } from 'framer-motion'

const navLinksBase = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/clients', label: 'Clients' },
  { href: '/earnings', label: 'Earnings' },
]

const navItemVariants = {
  hidden: { x: -20, opacity: 0 },
  visible: (i: number = 1) => ({
    x: 0,
    opacity: 1,
    transition: { delay: i * 0.05, duration: 0.3 },
  }),
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loadingRole, setLoadingRole] = useState(true)

  useEffect(() => {
    const fetchUserRoleAndOnboarding = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        if (!user) return

        // Fetch user profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, onboarded')
          .eq('user_id', user.id)
          .maybeSingle()

        if (profileError) throw profileError

        // Check onboarding
        const publicPages = ['/login', '/signup', '/onboarding']
        if (profile && profile.onboarded === false && !publicPages.includes(pathname)) {
          router.push('/onboarding')
        }

        // Set admin role
        if (profile?.role?.toLowerCase() === 'admin' || profile?.role?.toLowerCase() === 'owner') {
          setIsAdmin(true)
        }
      } catch (err) {
        console.error('Error fetching user role or onboarding status:', err)
      } finally {
        setLoadingRole(false)
      }
    }

    fetchUserRoleAndOnboarding()
  }, [pathname, router])

  // Build final nav links
  const navLinks = isAdmin
    ? navLinksBase.filter(link => link.href !== '/dashboard').concat({
        href: '/admin/dashboard',
        label: 'Admin Dashboard',
      })
    : navLinksBase

  return (
    <div className="min-h-screen flex bg-[var(--background)] text-[var(--foreground)] font-sans">
      {/* Sidebar */}
      <aside className="w-72 p-6 flex flex-col bg-[var(--accent-2)]/90 backdrop-blur-lg text-[var(--text-bright)] shadow-2xl">
        <Link href="/" className="text-3xl font-extrabold mb-10 text-center text-[var(--highlight)]">
          ✂️ ShearWork
        </Link>

        <nav className="flex flex-col space-y-3 mb-6">
          {navLinks.map((link, i) => (
            <motion.div
              key={link.href}
              initial="hidden"
              animate="visible"
              custom={i}
              variants={navItemVariants}
            >
              <Link
                href={link.href}
                className={`block px-4 py-3 rounded-lg text-lg transition-all ${
                  pathname === link.href
                    ? 'bg-[var(--accent-2)] text-[var(--foreground)] font-semibold shadow-md'
                    : 'hover:bg-[var(--accent-1)] hover:text-[var(--text-bright)]'
                }`}
              >
                {link.label}
              </Link>
            </motion.div>
          ))}
        </nav>

        <div className="mt-auto">
          <SignOutButton className="w-full" />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-[var(--background)] overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
