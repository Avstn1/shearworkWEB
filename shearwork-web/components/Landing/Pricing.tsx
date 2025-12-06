'use client'

import { motion } from 'framer-motion'

// Color palette
const COLORS = {
  background: '#181818',
  cardBg: '#1a1a1a',
  navBg: '#1b1d1b', 
  surface: 'rgba(37, 37, 37, 0.6)',
  surfaceSolid: '#252525',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
  text: '#FFFFFF',
  textMuted: 'rgba(255, 255, 255, 0.6)',
  green: '#73aa57',
  greenLight: '#5b8f52',
  greenGlow: 'rgba(115, 170, 87, 0.4)',
}

export default function Pricing() {
  const plans = [
    { name: 'Pro Monthly', price: '$20/month' },
    { name: 'Pro Yearly', price: '$220/month' },
    // Add more plans here later — layout stays centered
  ]

  return (
    <section
      id="pricing"
      className="py-24 text-center flex flex-col items-center"
      style={{
        background: `linear-gradient(180deg, #1a1a1a 0%, #1c1e1c 50%, #1a1a1a 100%)`,
      }}
    >
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="text-4xl font-bold mb-12"
        style={{ color: COLORS.text }}
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
                rounded-2xl shadow-md p-12
                hover:shadow-xl hover:-translate-y-1
                transition-all duration-300
                text-center w-72 backdrop-blur-lg
              "
              style={{
                backgroundColor: COLORS.cardBg,
                borderWidth: 1,
                borderColor: COLORS.glassBorder,
                boxShadow: `0 4px 20px ${COLORS.greenGlow}`,
              }}
            >
              <h3 
                className="text-2xl font-semibold mb-3"
                style={{ color: COLORS.text }}
              >
                {p.name}
              </h3>
              <p 
                className="text-3xl font-bold"
                style={{ color: COLORS.green }}
              >
                {p.price}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}