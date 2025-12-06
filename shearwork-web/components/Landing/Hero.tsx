'use client'

import { motion } from 'framer-motion'

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
}

export default function Hero() {
  return (
    <section 
      className="h-screen flex flex-col items-center justify-center text-center px-6 relative"
      style={{ 
        backgroundColor: COLORS.background,
        color: COLORS.text,
      }}
    >
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="text-5xl md:text-6xl font-bold mb-6 leading-tight"
        style={{ color: COLORS.text }}
      >
        Understand your business.
        <br />
        <span style={{ color: COLORS.green }}>Unlock your next level.</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
        className="text-lg md:text-xl max-w-2xl mb-10"
        style={{ color: COLORS.textMuted }}
      >
        Analyze performance, and retain clients effortlessly.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
        className="flex gap-4"
      >
        <a
          href="/signup"
          className="font-semibold px-8 py-3 rounded-full shadow-lg hover:scale-105 transition-transform duration-200"
          style={{ 
            backgroundColor: COLORS.green,
            color: '#000000',
          }}
        >
          Get Started
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
          Learn More
        </button>
      </motion.div>
    </section>
  )
}