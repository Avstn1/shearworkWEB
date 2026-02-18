'use client'

import { motion } from 'framer-motion'

// Color palette matching React Native app
const COLORS = {
  background: '#181818',
  text: '#FFFFFF',
  textMuted: 'rgba(255, 255, 255, 0.6)',
  green: '#73aa57',
  greenLight: '#5b8f52',
}

export default function Hero() {
  return (
    <section 
      className="min-h-screen flex flex-col items-center justify-center text-center px-6 pt-16 pb-24 sm:py-20 relative overflow-hidden"
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



      {/* Centered Content - In Front */}
      <div className="relative z-10 max-w-3xl w-full">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-5xl md:text-6xl font-bold mb-8 leading-tight"
          style={{ color: COLORS.text }}
        >
          Stop Relying on Hustle
          <br />
          to Stay Booked.
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
