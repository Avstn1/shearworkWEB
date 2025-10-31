'use client'

import { motion } from 'framer-motion'

export default function Contact() {
  return (
    <section
      id="contact"
      className="py-24 bg-[var(--accent-4)] text-center text-[var(--text-bright)] flex flex-col items-center"
    >
      {/* Header */}
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="text-4xl font-bold mb-6"
      >
        Ready to get started?
      </motion.h2>

      {/* Description */}
      <motion.p
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
        className="max-w-2xl mx-auto mb-10 text-lg text-[var(--text-subtle)]"
      >
        Let’s help you manage your barbershop effortlessly. Contact us for a free demo or onboarding assistance.
      </motion.p>

      {/* Contact Button — opens email client */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <a
          href="mailto:trackingvalid@gmail.com?subject=Barbershop Inquiry&body=Hi!%20I’d%20like%20to%20learn%20more%20about%20ShearWork."
          className="inline-block bg-[var(--highlight)] text-[var(--accent-4)] font-semibold text-lg px-10 py-4 rounded-full
                     hover:scale-105 hover:shadow-lg transition-transform duration-300"
        >
          Contact Us
        </a>
      </motion.div>
    </section>
  )
}
