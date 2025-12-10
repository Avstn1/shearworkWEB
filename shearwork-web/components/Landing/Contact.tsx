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

export default function Contact() {
  return (
    <section
      id="contact"
      className="h-screen flex flex-col items-center justify-center text-center px-6 relative"
      style={{
        background: `linear-gradient(135deg, #1a1a1a 0%, #1e221e 50%, #1a1f1a 100%)`,
        color: COLORS.text,
      }}
    >
      {/* Header */}
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="text-4xl font-bold mb-6"
        style={{ color: COLORS.text }}
      >
        Ready to get started?
      </motion.h2>

      {/* Description */}
      <motion.p
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
        className="max-w-2xl mx-auto mb-10 text-lg"
        style={{ color: COLORS.textMuted }}
      >
        Let's help you manage your barber business effortlessly. Contact us for a free demo or onboarding assistance.
      </motion.p>

      {/* Contact Button — opens email client */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <a
          href="mailto:trackingvalid@gmail.com?subject=Barber Stats Inquiry&body=Hi!%20I'd%20like%20to%20learn%20more%20about%Corva."
          className="inline-block font-semibold text-lg px-10 py-4 rounded-full hover:scale-105 hover:shadow-lg transition-transform duration-300"
          style={{ 
            background: `linear-gradient(135deg, ${COLORS.green} 0%, ${COLORS.greenLight} 100%)`,
            color: '#000000',
            boxShadow: `0 4px 20px ${COLORS.greenGlow}`,
          }}
        >
          Contact Us
        </a>
      </motion.div>
    </section>
  )
}