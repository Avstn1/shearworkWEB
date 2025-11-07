'use client'

import { motion } from 'framer-motion'

export default function Hero() {
  return (
    <section className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-[var(--background)]">
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="text-5xl md:text-6xl font-bold mb-6 text-[var(--accent-3)] leading-tight"
      >
        Understand your business.
        <br />
        <span className="text-[var(--highlight)]">Unlock your next level.</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
        className="text-lg md:text-xl text-[var(--text-muted)] max-w-2xl mb-10"
      >
        Analyze performance, and retain clients effortlessly.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
        className="flex gap-4"
      >
        <a
          href="/signup"
          className="bg-[var(--highlight)] text-[var(--accent-4)] font-semibold px-8 py-3 rounded-full shadow-md hover:scale-105 transition"
        >
          Get Started
        </a>
        <a
          href="#features"
          className="border border-[var(--highlight)] text-[var(--highlight)] px-8 py-3 rounded-full hover:bg-[var(--highlight)] hover:text-[var(--accent-4)] transition"
        >
          Learn More
        </a>
      </motion.div>
    </section>
  )
}
