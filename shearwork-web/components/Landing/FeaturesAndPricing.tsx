'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'

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

export default function FeaturesAndPricing() {
  const router = useRouter()

  const features = [
    { title: 'Business Insights', desc: 'Analytics & insights.', icon: '📊' },
    { title: 'Automated Reports', desc: 'Weekly summaries.', icon: '📈' },
    { title: 'Expense Tracking', desc: 'Track expenses.', icon: '💰' },
    { title: 'Tip Tracker', desc: 'Track tips.', icon: '💵' },
    { title: 'Acuity Integration', desc: 'Sync bookings.', icon: '🔗' },
  ]

  const plans = [{ name: 'Pro Monthly', price: '$20/month' }]

  return (
    <section
      className="h-screen flex items-center justify-center px-4 md:px-6"
      style={{
        background: `linear-gradient(135deg, #181818 0%, #1a1a1a 30%, #1c1e1c 70%, #181818 100%)`,
        color: COLORS.text,
      }}
    >
      <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row gap-4 md:gap-6 items-center justify-center">

        {/* LEFT — FEATURES */}
        <div className="w-full md:flex-[1.1] flex flex-col justify-center">
          <motion.h2
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-base md:text-lg font-bold mb-2"
          >
            Features
          </motion.h2>

          <div className="grid grid-cols-2 gap-2.5">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
                className={i === features.length - 1 ? 'col-span-2' : ''} // <-- last card spans 2 columns
              >
                <div
                  className="p-2.5 rounded-lg shadow hover:shadow-lg transition-all duration-300 backdrop-blur-lg cursor-pointer"
                  style={{
                    background: `linear-gradient(135deg, ${COLORS.cardBg} 0%, #1c1e1c 100%)`,
                    borderWidth: 1,
                    borderColor: COLORS.glassBorder,
                  }}
                >
                  <div className="text-base mb-0.5">{f.icon}</div>
                  <h3 className="text-[11px] font-bold" style={{ color: COLORS.green }}>
                    {f.title}
                  </h3>
                  <p className="text-[9px] leading-tight" style={{ color: COLORS.textMuted }}>
                    {f.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* DIVIDER (desktop only) */}
        <div
          className="hidden md:block w-px h-52"
          style={{
            background: `linear-gradient(180deg, transparent 0%, ${COLORS.glassBorder} 50%, transparent 100%)`,
          }}
        />

        {/* RIGHT — PRICING */}
        <div className="w-full md:flex-1 flex flex-col justify-center">
          <motion.h2
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-base md:text-lg font-bold mb-2"
          >
            Pricing
          </motion.h2>

          {plans.map((p, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div
                className="rounded-lg shadow-md hover:shadow-lg transition-all duration-300 p-3 backdrop-blur-lg flex flex-col"
                style={{
                  background: `linear-gradient(135deg, ${COLORS.cardBg} 0%, #1e221e 100%)`,
                  borderWidth: 2,
                  borderColor: COLORS.green,
                }}
              >
                <h3 className="text-sm font-bold mb-1">{p.name}</h3>

                <div className="flex items-baseline gap-1 mb-2">
                  <p className="text-2xl font-bold" style={{ color: COLORS.green }}>
                    {p.price.split('/')[0]}
                  </p>
                  <span className="text-xs" style={{ color: COLORS.textMuted }}>
                    /{p.price.split('/')[1]}
                  </span>
                </div>

                <div className="space-y-1 mb-2">
                  {['Automated reports', 'Expense tracking', 'Analytics', 'Acuity integration'].map(
                    (feature, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <div
                          className="w-1 h-1 rounded-full"
                          style={{ backgroundColor: COLORS.green }}
                        />
                        <span className="text-[10px]" style={{ color: COLORS.textMuted }}>
                          {feature}
                        </span>
                      </div>
                    )
                  )}
                </div>

                <button
                  className="w-full py-1.5 rounded-md font-semibold text-xs transition-all duration-300 hover:scale-105"
                  onClick={() => router.push('/signup')}
                  style={{
                    background: `linear-gradient(135deg, ${COLORS.green} 0%, ${COLORS.greenLight} 100%)`,
                    color: '#000',
                  }}
                >
                  Get Started
                </button>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  )
}
