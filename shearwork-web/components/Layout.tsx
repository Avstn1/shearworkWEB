'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import SignOutButton from '@/components/SignOutButton'

const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/clients', label: 'Clients' },
  { href: '/earnings', label: 'Earnings' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen flex bg-[var(--background)] text-[var(--foreground)] font-sans">
      {/* Sidebar */}
      <aside className="w-72 p-6 flex flex-col bg-[var(--accent-2)]/90 backdrop-blur-lg text-[var(--text-bright)] shadow-2xl">
        <Link href="/" className="text-3xl font-extrabold mb-10 text-center text-[var(--highlight)]">
          ✂️ ShearWork
        </Link>

        <nav className="flex flex-col space-y-3 mb-6">
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`block px-4 py-3 rounded-lg text-lg transition-all ${
                pathname === link.href
                  ? 'bg-[var(--accent-2)] text-[var(--foreground)] font-semibold shadow-md'
                  : 'hover:bg-[var(--accent-1)] hover:text-[var(--text-bright)]'
              }`}
            >
              {link.label}
            </Link>
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
