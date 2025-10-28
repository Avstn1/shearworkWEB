'use client'

import { motion } from 'framer-motion'

export default function Features() {
  const features = [
    { title: 'Smart Scheduling', desc: 'Drag-and-drop appointments with automatic reminders.', icon: '🗓️' },
    { title: 'Business Insights', desc: 'See your revenue, trends, and performance in real-time.', icon: '📊' },
    { title: 'Client Retention', desc: 'Automate follow-ups and build loyal relationships.', icon: '💬' },
  ]

  return (
    <section id="features" className="py-24 bg-[var(--text-bright)] text-center">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="text-4xl font-bold text-[var(--accent-4)] mb-12"
      >
        Why Barbers Choose ShearWork
      </motion.h2>

      <div className="max-w-6xl mx-auto grid gap-8 md:grid-cols-3 px-6">
        {features.map((f, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.4, delay: i * 0.15, ease: 'easeOut' }}
          >
            <div
              className="p-8 rounded-2xl shadow-md bg-[var(--accent-1)] text-[var(--text-bright)]
                         hover:shadow-xl hover:-translate-y-1 transition-transform duration-300 border border-[var(--accent-2)]"
            >
              <div className="text-4xl mb-4">{f.icon}</div>
              <h3 className="text-2xl font-semibold mb-2 text-[var(--highlight)]">{f.title}</h3>
              <p className="text-[var(--text-subtle)]">{f.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
