'use client'

import { motion } from 'framer-motion'

export default function Pricing() {
  const plans = [
    {
      name: 'Basic',
      price: '$0',
      features: ['1 Barber', 'Basic Scheduling', 'Email Reminders'],
    },
    {
      name: 'Pro',
      price: '$19/mo',
      features: ['5 Barbers', 'Analytics Dashboard', 'Client Messaging'],
    },
    {
      name: 'Business',
      price: '$49/mo',
      features: ['Unlimited Barbers', 'Custom Branding', 'Priority Support'],
    },
  ]

  return (
    <section id="pricing" className="py-24 bg-[var(--background)] text-center">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="text-4xl font-bold text-[var(--accent-3)] mb-12"
      >
        Simple, transparent pricing
      </motion.h2>

      <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8 px-6">
        {plans.map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.6, delay: i * 0.2, ease: 'easeOut' }}
          >
            <div
              className="rounded-2xl bg-white shadow-md p-8 hover:shadow-xl hover:-translate-y-1
                         transition-transform duration-300 border border-[var(--accent-2)]"
            >
              <h3 className="text-2xl font-semibold text-[var(--accent-3)] mb-4">{p.name}</h3>
              <p className="text-3xl font-bold text-[var(--highlight)] mb-6">{p.price}</p>
              <ul className="space-y-2 text-[var(--text-subtle)] mb-8">
                {p.features.map((f, j) => (
                  <li key={j}>• {f}</li>
                ))}
              </ul>
              <button className="bg-[var(--highlight)] text-[var(--accent-4)] font-semibold px-6 py-3 rounded-full hover:scale-105 transition-transform duration-300">
                Choose Plan
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
