'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'


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

export default function FeaturesAndPricing() {
  const router = useRouter()
  
  const features = [
    {
      title: 'Business Insights',
      desc: 'Real-time revenue and performance analytics.',
      icon: '📊',
    },
    {
      title: 'Automated Reports',
      desc: 'Weekly and monthly reports to your inbox.',
      icon: '📈',
    },
    {
      title: 'Expense Tracking',
      desc: 'Monitor expenses with built-in tracker.',
      icon: '💰',
    },
    {
      title: 'Tip Tracker',
      desc: 'Track daily tips effortlessly.',
      icon: '💵',
    },
    {
      title: 'Acuity Integration',
      desc: 'Sync appointments seamlessly.',
      icon: '🔗',
    },
  ]

  const plans = [
    { name: 'Pro Monthly', price: '$20/month' },
  ]

  return (
    <section 
      className="h-screen flex items-center overflow-hidden px-8 relative"
      style={{
        background: `linear-gradient(135deg, #181818 0%, #1a1a1a 30%, #1c1e1c 70%, #181818 100%)`,
        color: COLORS.text,
      }}
    >
      <div className="max-w-7xl mx-auto w-full flex gap-12 items-center">
        {/* Left Side: Features Section */}
        <div className="flex-[1.2] flex flex-col justify-center">
          {/* Features Header */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="text-3xl font-bold mb-6"
            style={{ color: COLORS.text }}
          >
            Features
          </motion.h2>

          <div className="grid grid-cols-2 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.1, ease: 'easeOut' }}
              >
                <div
                  className="p-4 rounded-2xl shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 backdrop-blur-lg group cursor-pointer h-full"
                  style={{
                    background: `linear-gradient(135deg, ${COLORS.cardBg} 0%, #1c1e1c 100%)`,
                    borderWidth: 1,
                    borderColor: COLORS.glassBorder,
                  }}
                >
                  <div 
                    className="text-2xl mb-2 transition-transform duration-300 group-hover:scale-110"
                  >
                    {f.icon}
                  </div>
                  <h3 
                    className="text-sm font-bold mb-1 transition-colors duration-300"
                    style={{ color: COLORS.green }}
                  >
                    {f.title}
                  </h3>
                  <p 
                    className="text-xs leading-relaxed"
                    style={{ color: COLORS.textMuted }}
                  >
                    {f.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div 
          className="w-px h-96 rounded-full"
          style={{
            background: `linear-gradient(180deg, transparent 0%, ${COLORS.glassBorder} 50%, transparent 100%)`,
          }}
        />

        {/* Right Side: Pricing Section */}
        <div className="flex-1 flex flex-col items-start justify-center">
          {/* Pricing Header */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="text-3xl font-bold mb-6"
            style={{ color: COLORS.text }}
          >
            Pricing
          </motion.h2>

          <div className="w-full">
            {plans.map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: i * 0.15, ease: 'easeOut' }}
              >
                <div
                  className="relative rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 p-6 backdrop-blur-lg overflow-hidden group cursor-pointer flex flex-col"
                  style={{
                    background: `linear-gradient(135deg, ${COLORS.cardBg} 0%, #1e221e 100%)`,
                    borderWidth: 2,
                    borderColor: COLORS.green,
                    height: '380px',
                  }}
                >
                  <div className="relative z-10 flex flex-col h-full">
                    <div 
                      className="absolute -top-3 -right-3 px-2 py-1 rounded-full text-xs font-bold"
                      style={{ 
                        backgroundColor: COLORS.green,
                        color: '#000000',
                      }}
                    >
                      Popular
                    </div>
                    
                    <h3 
                      className="text-xl font-bold mb-2"
                      style={{ color: COLORS.text }}
                    >
                      {p.name}
                    </h3>
                    
                    <div className="flex items-baseline gap-2 mb-4">
                      <p 
                        className="text-4xl font-bold"
                        style={{ color: COLORS.green }}
                      >
                        {p.price.split('/')[0]}
                      </p>
                      <span style={{ color: COLORS.textMuted }}>
                        /{p.price.split('/')[1]}
                      </span>
                    </div>

                    {/* Features List */}
                    <div className="mb-auto space-y-2">
                      {[
                        'Automated reports',
                        'Expense & tip tracking',
                        'Client analytics',
                        'Acuity integration',
                      ].map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div 
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: COLORS.green }}
                          />
                          <span 
                            className="text-sm"
                            style={{ color: COLORS.textMuted }}
                          >
                            {feature}
                          </span>
                        </div>
                      ))}
                    </div>

                    <button
                      className="w-full py-3 rounded-xl font-semibold transition-all duration-300 hover:scale-105 mt-4"
                      onClick={() => router.push('/signup')}
                      style={{
                        background: `linear-gradient(135deg, ${COLORS.green} 0%, ${COLORS.greenLight} 100%)`,
                        color: '#000000',
                      }}
                    >
                      Get Started
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}