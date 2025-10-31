'use client'

import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Hero from '@/components/Hero'
import Features from '@/components/Features'
import Pricing from '@/components/Pricing'
import Contact from '@/components/Contact'
import Footer from '@/components/Footer'

export default function LandingPage() {
  return (
    <main className="flex flex-col min-h-screen overflow-x-hidden">
      <Navbar />
      <Hero />
      <Features />
      <Pricing />
      <Contact />
      <Footer />
    </main>
  )
}
