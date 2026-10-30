'use client'

import { motion } from 'framer-motion'
import { ButtonLink } from '@/components/ui/Button'
import { BrandMark } from '@/components/ui/BrandMark'

export default function Contact() {
  return (
    <section
      id="contact"
      className="relative h-screen flex flex-col items-center justify-center text-center px-6 overflow-hidden text-ivory"
      style={{ background: 'radial-gradient(80% 70% at 50% 35%, #1E241A 0%, #12150F 55%, #0B0D09 100%)' }}
    >
      {/* Halo */}
      <div className="pointer-events-none absolute left-1/2 top-[38%] h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(93_106_72/0.4),transparent)] blur-2xl" />
      <div className="pointer-events-none absolute left-1/2 top-[38%] h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.05]" />
      <div className="pointer-events-none absolute left-1/2 top-[38%] h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.03]" />

      <motion.span
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative mb-8 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-olive-bright/70 to-forest-900 text-sage-bright ring-1 ring-inset ring-white/10 shadow-[0_0_48px_-10px_rgb(170_179_154/0.7)]"
      >
        <BrandMark className="h-9 w-9" />
      </motion.span>

      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative text-4xl md:text-6xl font-semibold tracking-[-0.035em] mb-6"
      >
        Ready to stop{' '}
        <span className="bg-gradient-to-r from-sage-bright to-sage bg-clip-text text-transparent">guessing?</span>
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
        className="relative max-w-2xl mx-auto mb-10 text-lg text-muted"
      >
        Let&apos;s show you how Corva turns your numbers into a clear plan. Get a free walkthrough.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.18, ease: 'easeOut' }}
        className="relative flex flex-col sm:flex-row items-center gap-3"
      >
        <ButtonLink href="/support" size="lg" arrow>Get a free walkthrough</ButtonLink>
        <ButtonLink href="/signup" size="lg" variant="glass">Start 21-Day Free Trial</ButtonLink>
      </motion.div>
    </section>
  )
}
