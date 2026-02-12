'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'

// Color palette matching React Native app
const COLORS = {
  background: '#181818',
  text: '#FFFFFF',
  textMuted: 'rgba(255, 255, 255, 0.6)',
  green: '#73aa57',
  greenLight: '#5b8f52',
  teal: '#7affc9',
  cyan: '#3af1f7',
  yellow: '#f5e29a',
  border: '#2a2a2a',
}

export default function Hero() {
  return (
    <section 
      className="min-h-screen flex flex-col items-center justify-center text-center px-6 py-20 relative overflow-hidden"
      style={{ 
        backgroundColor: COLORS.background,
        color: COLORS.text,
      }}
    >
      {/* Enhanced gradient background effects - darker for more contrast */}
      <div 
        className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full blur-3xl opacity-20"
        style={{ backgroundColor: COLORS.green }}
      />
      <div 
        className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full blur-3xl opacity-15"
        style={{ backgroundColor: '#2a2a2a' }}
      />
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-3xl opacity-15"
        style={{ backgroundColor: '#1a1a1a' }}
      />

      {/* Background Screenshot Showcase - Faded */}
      <div className="absolute inset-0 flex items-center justify-center opacity-10">
        <div className="relative w-full max-w-7xl mx-auto flex items-center justify-center gap-8">
          {/* Left Side - Two Cards Stacked */}
          <div className="flex flex-col gap-6 items-end">
            {/* Recurring Expenses */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
              style={{
                filter: 'drop-shadow(0 20px 50px rgba(0, 0, 0, 0.4))',
              }}
            >
              <div 
                className="relative w-[200px] md:w-[240px] h-[200px] md:h-[240px] rounded-2xl overflow-hidden"
                style={{
                  border: `1px solid ${COLORS.border}`,
                  background: 'linear-gradient(145deg, #1e1e1e 0%, #181818 100%)',
                }}
              >
                <div 
                  className="absolute inset-0 z-10 pointer-events-none"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)',
                  }}
                />
                <Image
                  src="/heroImages/recurringExpenses.png"
                  alt="Recurring Expenses"
                  fill
                  className="object-cover"
                />
              </div>
            </motion.div>

            {/* Service Breakdown */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
              style={{
                filter: 'drop-shadow(0 20px 50px rgba(0, 0, 0, 0.4))',
              }}
            >
              <div 
                className="relative w-[260px] md:w-[450px] h-[160px] md:h-[215px] rounded-2xl overflow-hidden"
                style={{
                  border: `1px solid ${COLORS.border}`,
                  background: 'linear-gradient(145deg, #1e1e1e 0%, #181818 100%)',
                }}
              >
                <div 
                  className="absolute inset-0 z-10 pointer-events-none"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)',
                  }}
                />
                <Image
                  src="/heroImages/serviceBreakdown.png"
                  alt="Service Breakdown"
                  fill
                  className="object-cover"
                />
              </div>
            </motion.div>
          </div>

          {/* Center - Mobile Dashboard */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{
              filter: 'drop-shadow(0 30px 80px rgba(115, 170, 87, 0.3))',
            }}
          >
            <div 
              className="relative rounded-[32px] p-2"
              style={{
                background: 'linear-gradient(145deg, #1a1a1a 0%, #0f0f0f 100%)',
                border: `1px solid ${COLORS.border}`,
              }}
            >
              <div 
                className="absolute top-3 left-1/2 -translate-x-1/2 w-20 h-4 rounded-full z-30"
                style={{ backgroundColor: '#000' }}
              />
              <div className="relative w-[220px] md:w-[260px] h-[440px] md:h-[520px] rounded-[28px] overflow-hidden bg-black">
                <Image
                  src="/heroImages/mobileDashboard.png"
                  alt="Mobile Dashboard"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </div>
          </motion.div>

          {/* Right Side - Two Cards Stacked */}
          <div className="flex flex-col gap-6 items-start">
            {/* Weekly Reports */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
              style={{
                filter: 'drop-shadow(0 20px 50px rgba(0, 0, 0, 0.4))',
              }}
            >
              <div 
                className="relative w-[200px] md:w-[240px] h-[200px] md:h-[240px] rounded-2xl overflow-hidden"
                style={{
                  border: `1px solid ${COLORS.border}`,
                  background: 'linear-gradient(145deg, #1e1e1e 0%, #181818 100%)',
                }}
              >
                <div 
                  className="absolute inset-0 z-10 pointer-events-none"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)',
                  }}
                />
                <Image
                  src="/heroImages/weeklyReports.png"
                  alt="Weekly Reports"
                  fill
                  className="object-cover"
                />
              </div>
            </motion.div>

            {/* Monthly Expenses */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
              style={{
                filter: 'drop-shadow(0 20px 50px rgba(0, 0, 0, 0.4))',
              }}
            >
              <div 
                className="relative w-[260px] md:w-[450px] h-[160px] md:h-[210px] rounded-2xl overflow-hidden"
                style={{
                  border: `1px solid ${COLORS.border}`,
                  background: 'linear-gradient(145deg, #1e1e1e 0%, #181818 100%)',
                }}
              >
                <div 
                  className="absolute inset-0 z-10 pointer-events-none"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)',
                  }}
                />
                <Image
                  src="/heroImages/marketingFunnels.png"
                  alt="Marketing Funnels"
                  fill
                  className="object-cover"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Centered Content - In Front */}
      <div className="relative z-10 max-w-3xl w-full">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-5xl md:text-6xl font-bold mb-8 leading-tight"
          style={{ color: COLORS.text }}
        >
          Stop Letting Cancellations
          <br />
          Cost You Money.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
          className="text-lg md:text-xl mb-4 mx-auto"
          style={{ color: COLORS.textMuted }}
        >
          Corva detects your open spots and automatically reminds past clients so you recover bookings you would have missed.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
          className="text-sm md:text-base mb-8"
          style={{ color: COLORS.textMuted }}
        >
          Independent barbers do not need more hustle. They need a system.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
          className="flex flex-col items-center gap-4"
        >
          <div className="flex gap-5 justify-center">
            <a
              href="/signup"
              className="font-semibold px-10 py-3 rounded-full shadow-lg hover:scale-105 transition-transform duration-200"
              style={{ 
                backgroundColor: COLORS.green,
                color: '#000000',
              }}
            >
              Start 21-Day Free Trial
            </a>
            <button
              onClick={() => {
                const container = document.querySelector('[data-scroll-container]') as HTMLElement
                if (container) {
                  const sectionWidth = window.innerWidth
                  container.scrollTo({
                    left: sectionWidth,
                    behavior: 'smooth'
                  })
                } else {
                  const scrollContainer = document.querySelector('.overflow-x-scroll') as HTMLElement
                  if (scrollContainer) {
                    scrollContainer.scrollTo({
                      left: window.innerWidth,
                      behavior: 'smooth'
                    })
                  }
                }
              }}
              className="px-8 py-3 rounded-full border transition-all duration-200 hover:scale-105 cursor-pointer"
              style={{ 
                borderColor: COLORS.green,
                color: COLORS.green,
                backgroundColor: 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = COLORS.green
                e.currentTarget.style.color = '#000000'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = COLORS.green
              }}
            >
              See How It Works
            </button>
          </div>
          <p className="text-xs md:text-sm" style={{ color: COLORS.textMuted }}>
            No credit card required. Takes 2 minutes.
          </p>
          <a 
            href="/login" 
            className="text-sm hover:underline transition-all"
            style={{ color: '#a0a0a0' }}
          >
            Already have an account?{' '}
            <span className="font-semibold" style={{ color: COLORS.green }}>Sign in</span>
          </a>
        </motion.div>
      </div>
    </section>
  )
}
