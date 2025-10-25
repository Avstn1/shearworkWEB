'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SignOutButton from '@/components/SignOutButton';

const navLinks = [
  { href: '/', label: 'Dashboard' },
  { href: '/clients', label: 'Clients' },
  { href: '/earnings', label: 'Earnings' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex bg-[var(--background)] text-[var(--foreground)] font-sans">
      {/* Sidebar */}
      <aside className="w-72 p-6 flex flex-col bg-[var(--accent-3)] text-[var(--accent-4)] shadow-xl">
        <a href="/" className="text-3xl font-bold mb-10 text-center text-[var(--accent-4)]">
          ✂️ ShearWork
        </a>

        <nav className="flex flex-col space-y-3 mb-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`block px-4 py-3 rounded-lg text-lg transition ${
                pathname === link.href
                  ? 'bg-[var(--accent-2)] text-[var(--accent-4)] font-semibold'
                  : 'hover:bg-[var(--accent-1)] hover:text-[var(--foreground)]'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>


        <SignOutButton />

      </aside>

      {/* Main content */}
      <main className="flex-1 bg-[var(--accent-1)]/20 flex flex-col">
        {children}
      </main>
    </div>
  );
}
