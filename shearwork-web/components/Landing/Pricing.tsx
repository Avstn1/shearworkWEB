'use client'

import { motion } from 'framer-motion'

export default function Pricing() {
  const plans = [
    { name: 'Basic', price: '$20/month' },
    // Add more plans here later — layout stays centered
  ]

  return (
    <section
      id="pricing"
      className="py-24 bg-[var(--background)] text-center flex flex-col items-center"
    >
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="text-4xl font-bold text-[var(--accent-3)] mb-12"
      >
        Simple, transparent pricing
      </motion.h2>

      {/* Use flex so cards are always centered horizontally */}
      <div className="max-w-6xl w-full mx-auto px-6 flex flex-wrap justify-center gap-8">
        {plans.map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.6, delay: i * 0.15, ease: 'easeOut' }}
            className="flex"
          >
            <div
              className="
                flex flex-col items-center justify-center
                rounded-2xl bg-white shadow-md p-12
                hover:shadow-xl hover:-translate-y-1
                transition-transform duration-300
                border border-[var(--accent-2)]
                text-center w-72
              "
            >
              <h3 className="text-2xl font-semibold text-[var(--accent-3)] mb-3">{p.name}</h3>
              <p className="text-3xl font-bold text-[var(--highlight)]">{p.price}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
