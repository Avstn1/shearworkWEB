'use client'

import { motion } from 'framer-motion'

// Color palette
const COLORS = {
  background: '#13171C',
  cardBg: '#161A21',
  navBg: '#13171C', 
  surface: 'rgba(238, 241, 245, 0.05)',
  surfaceSolid: '#151920',
  glassBorder: 'rgba(238, 241, 245, 0.09)',
  text: '#EEF1F5',
  textMuted: 'rgba(238, 241, 245, 0.62)',
  green: '#3DD27A',
  greenLight: '#3DD27A',
  greenGlow: 'rgba(61, 210, 122, 0.4)',
}

export default function Features() {
 const features = [
    {
      title: 'Auto-Fill Engine',
      desc: 'Detects open spots and fills them before they go to waste.',
      icon: '⚡',
    },
    {
      title: 'Smart Client Reminders',
      desc: 'Reaches past clients at the right time to recover bookings.',
      icon: '💬',
    },
    {
      title: 'Booking Alerts',
      desc: 'Get notified the moment a reminder turns into a booking.',
      icon: '🔔',
    },
    {
      title: 'Simple Performance Insights',
      desc: 'See what is working without getting buried in dashboards.',
      icon: '📈',
    },
    {
      title: 'Booking Integration',
      desc: 'Connect Acuity or Square so everything stays in sync.',
      icon: '🔗',
    },
  ]

  return (
    <section 
      id="features" 
      className="py-24 text-center"
      style={{
        background: `linear-gradient(180deg, #13171C 0%, #161A21 50%, #13171C 100%)`,
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
        How Corva Makes You More Money
      </motion.h2>

      {/* ✅ Switched from grid to flex for proper horizontal centering */}
      <div className="max-w-6xl w-full mx-auto px-6 flex flex-wrap justify-center gap-8">
        {features.map((f, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.4, delay: i * 0.15, ease: 'easeOut' }}
            className="flex"
          >
            <div
              className="
                p-8 rounded-2xl shadow-md hover:shadow-xl hover:-translate-y-1 
                transition-all duration-300 text-center w-72 backdrop-blur-lg
              "
              style={{
                backgroundColor: COLORS.cardBg,
                borderWidth: 1,
                borderColor: COLORS.glassBorder,
                boxShadow: `0 4px 20px ${COLORS.greenGlow}`,
              }}
            >
              <div className="text-4xl mb-4">{f.icon}</div>
              <h3 
                className="text-2xl font-semibold mb-2"
                style={{ color: COLORS.green }}
              >
                {f.title}
              </h3>
              <p style={{ color: COLORS.textMuted }}>{f.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
