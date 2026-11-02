'use client'

import { motion } from 'framer-motion'
import { ButtonLink } from '@/components/ui/Button'

export default function Contact() {
  return (
    <section
      id="contact"
      className="relative bg-canvas h-screen flex flex-col items-center justify-center text-center px-6 overflow-hidden text-ivory"
    >
      <div className="aurora-bg" />
      {/* Halo */}

      <motion.span
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative mb-8 grid h-16 w-16 place-items-center rounded-xl bg-white/[0.05] ring-1 ring-inset ring-white/10"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/corvalogo.png" alt="" className="h-11 w-auto" />
      </motion.span>

      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative font-display text-4xl md:text-6xl font-semibold tracking-[-0.045em] mb-6"
      >
        Ready to stop{' '}
        <span className="text-gradient-aurora">guessing?</span>
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
