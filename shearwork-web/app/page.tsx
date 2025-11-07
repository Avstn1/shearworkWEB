'use client'

import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Hero from '@/components/Landing/Hero'
import Features from '@/components/Landing/Features'
import Pricing from '@/components/Landing/Pricing'
import Contact from '@/components/Landing/Contact'
import Footer from '@/components/Landing/Footer'

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
