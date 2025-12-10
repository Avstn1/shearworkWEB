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

export default function Features() {
 const features = [
    {
      title: 'Business Insights',
      desc: 'See your revenue, trends, and performance in real-time with comprehensive analytics.',
      icon: '📊',
    },
    {
      title: 'Automated Reports',
      desc: 'Weekly and monthly reports automatically generated and delivered to your inbox.',
      icon: '📈',
    },
    {
      title: 'Expense Tracking',
      desc: 'Monitor all your business expenses in one place with our built-in tracker.',
      icon: '💰',
    },
    {
      title: 'Tip Tracker',
      desc: 'Never lose track of your daily tips with easy logging and totals.',
      icon: '💵',
    },
    {
      title: 'Acuity Integration',
      desc: 'Seamlessly sync your appointments from Acuity Scheduling.',
      icon: '🔗',
    },
  ]

  return (
    <section 
      id="features" 
      className="py-24 text-center"
      style={{
        background: `linear-gradient(180deg, #181818 0%, #1a1a1a 50%, #181818 100%)`,
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
        Why Barbers Choose Corva
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