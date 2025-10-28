'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'

export default function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <nav className="fixed top-0 w-full z-50 bg-[var(--navbar)]/90 backdrop-blur-md shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <Link href="/" className="text-2xl font-bold text-[var(--accent-3)]">
          ✂️ ShearWork
        </Link>

        <div className="hidden md:flex gap-8 text-[var(--foreground)]">
          <a href="#features" className="hover:text-[var(--highlight)]">Features</a>
          <a href="#pricing" className="hover:text-[var(--highlight)]">Pricing</a>
          <a href="#contact" className="hover:text-[var(--highlight)]">Contact</a>
        </div>

        <div className="hidden md:flex gap-3">
          <Link href="/login" className="px-4 py-2 rounded-md border border-[var(--accent-2)] text-[var(--accent-3)] hover:bg-[var(--accent-2)] hover:text-[var(--text-bright)] transition">Sign In</Link>
          <Link href="/signup" className="px-4 py-2 rounded-md bg-[var(--highlight)] text-[var(--accent-4)] font-semibold hover:scale-105 transition">Sign Up</Link>
        </div>

        <button className="md:hidden" onClick={() => setOpen(!open)}>
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-[var(--background)] border-t border-[var(--accent-2)]">
          <div className="flex flex-col items-center py-4 space-y-4">
            <a href="#features" onClick={() => setOpen(false)}>Features</a>
            <a href="#pricing" onClick={() => setOpen(false)}>Pricing</a>
            <a href="#contact" onClick={() => setOpen(false)}>Contact</a>
            <Link href="/login" onClick={() => setOpen(false)}>Sign In</Link>
            <Link href="/signup" onClick={() => setOpen(false)} className="bg-[var(--highlight)] px-4 py-2 rounded-md text-[var(--accent-4)]">Sign Up</Link>
          </div>
        </div>
      )}
    </nav>
  )
}
