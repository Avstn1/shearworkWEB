'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'

const COLORS = {
  text: '#FFFFFF',
  textMuted: 'rgba(255, 255, 255, 0.6)',
  textSubtle: 'rgba(255, 255, 255, 0.4)',
  green: '#73aa57',
  greenGlow: 'rgba(115, 170, 87, 0.3)',
}

function SmsBubble() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.6, ease: 'easeOut' }}
      className="absolute top-[-60px] left-1/2 -translate-x-1/2 w-[250px] sm:w-[280px] lg:w-[310px] z-20"
    >
      <div 
        className="rounded-2xl p-3 sm:p-4 bg-zinc-900/80 border border-white/10 backdrop-blur-xl"
        style={{
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.05)',
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: COLORS.green, color: '#000' }}
          >
            C
          </div>
          <span className="text-xs sm:text-sm font-medium text-white">Corva</span>
          <span className="text-[10px] sm:text-xs ml-auto text-white/40">10:00 AM</span>
        </div>
        <p className="text-[11px] sm:text-xs leading-relaxed mb-2 text-white/60">
          Hey Gavin, it&apos;s Corva. You have 22 empty slots this week. Want me to help fill them?
        </p>
        <p className="text-[10px] sm:text-[11px] text-white/40">
          Reply YES to continue and STOP to unsubscribe.
        </p>
      </div>
    </motion.div>
  )
}

function SuccessToast() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.9, ease: 'easeOut' }}
      className="absolute bottom-[10px] left-1/2 -translate-x-1/2 w-[240px] sm:w-[270px] lg:w-[300px] z-20"
      style={{
        boxShadow: '0 0 0 1px rgba(16,185,129,0.35), 0 18px 50px rgba(16,185,129,0.10), 0 8px 24px rgba(0,0,0,0.3)',
      }}
    >
      <Image
        src="/heroImages/notification-success.png"
        alt="SMS Auto-nudge success notification"
        width={1320}
        height={266}
        className="w-full h-auto rounded-xl"
        quality={100}
      />
    </motion.div>
  )
}

function MockupCard() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.7, delay: 0.3, ease: 'easeOut' }}
      className="relative w-full max-w-[315px] lg:max-w-[345px] mx-auto lg:mx-0 lg:ml-auto"
    >
      {/* Glow behind the card */}
      <div className="absolute inset-0 rounded-[32px] blur-2xl bg-emerald-500/10 -z-10" />

      {/* Device/Card Shell */}
      <div
        className="relative rounded-[32px] border border-white/10 bg-white/5 p-4 sm:p-5 backdrop-blur"
        style={{
          boxShadow: '0 30px 120px rgba(0, 0, 0, 0.55)',
        }}
      >
        {/* Shell highlight */}
        <div className="pointer-events-none absolute inset-0 rounded-[32px] bg-gradient-to-b from-white/10 via-white/5 to-transparent" />
        
        {/* Shell vignette */}
        <div className="pointer-events-none absolute inset-0 rounded-[32px] bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_20%,rgba(0,0,0,0.35)_100%)]" />

        {/* CONTENT AREA: natural image dimensions */}
        <div className="relative w-full overflow-hidden rounded-[18px] border border-white/10">
          <Image
            src="/heroImages/corva-calendar.png"
            alt="Schedule"
            width={267}
            height={414}
            className="w-full h-auto"
            priority
            quality={100}
            style={{ filter: 'saturate(0.72) brightness(0.93) contrast(0.98) blur(2.75px)' }}
          />

          {/* Inner card frame */}
          <div className="pointer-events-none absolute inset-0 rounded-[18px] ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]" />
          
          {/* Top fog */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[46%] bg-gradient-to-b from-white/[0.18] via-white/[0.08] to-transparent" />
          
          {/* Bottom fade */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-t from-black/25 to-transparent" />

          {/* Subtle noise */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
            style={{
              backgroundImage:
                'repeating-radial-gradient(circle at 20% 20%, rgba(255,255,255,0.10) 0, rgba(255,255,255,0.10) 1px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 6px)',
            }}
          />

        </div>
      </div>

      {/* SMS Bubble - outside the shell so it can overflow */}
      <SmsBubble />

      {/* Success Toast - outside the shell so it can overflow */}
      <SuccessToast />
    </motion.div>
  )
}

export default function Hero() {
  const scrollToHowItWorks = () => {
    const section = document.getElementById('how-it-works')
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' })
    } else {
      const container = document.querySelector('[data-scroll-container]') as HTMLElement
      if (container) {
        container.scrollTo({ left: window.innerWidth, behavior: 'smooth' })
      } else {
        const scrollContainer = document.querySelector('.overflow-x-scroll') as HTMLElement
        if (scrollContainer) {
          scrollContainer.scrollTo({ left: window.innerWidth, behavior: 'smooth' })
        }
      }
    }
  }

  return (
    <section
      className="min-h-screen flex items-center relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #050505 0%, #0a0a0a 30%, #0d1210 60%, #080808 100%)',
        color: COLORS.text,
      }}
    >
      {/* Vignette overlay - darkened edges */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_70%_70%_at_50%_50%,rgba(0,0,0,0)_0%,rgba(0,0,0,.6)_70%,rgba(0,0,0,.85)_100%)]" />

      {/* Emerald blob - top left (soft, pushed away from text) */}
      <div className="absolute -top-40 -left-60 w-[600px] h-[600px] rounded-full blur-[120px] bg-emerald-600/8 pointer-events-none" />

      {/* Emerald blob - right side (stronger, behind mockup) */}
      <div className="absolute top-1/4 -right-20 w-[800px] h-[800px] rounded-full blur-[140px] bg-emerald-500/15 pointer-events-none" />

      {/* Dark pocket behind text for maximum contrast */}
      <div className="absolute left-0 top-0 w-[55%] h-full pointer-events-none bg-gradient-to-r from-black/60 via-black/30 to-transparent" />

      {/* Main content */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-8 lg:px-16 pt-32 lg:pt-36 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_0.7fr] gap-12 lg:gap-20 xl:gap-28 items-center">
          
          {/* Left Column - Copy (DOMINANT) */}
          <div className="max-w-2xl">
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-10 tracking-tight"
              style={{ lineHeight: '1.08' }}
            >
              <span className="whitespace-nowrap">Stop Relying on Hustle</span>
              <br />
              <span className="whitespace-nowrap bg-gradient-to-r from-white via-white to-emerald-300 bg-clip-text text-transparent">to Stay Booked.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.12, ease: 'easeOut' }}
              className="text-lg sm:text-xl lg:text-2xl mb-8 max-w-xl"
              style={{ color: 'rgba(255,255,255,0.7)', lineHeight: '1.6' }}
            >
              Corva detects your open spots and automatically reminds past clients so you recover bookings you would have missed.
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.18, ease: 'easeOut' }}
              className="text-base sm:text-lg mb-12 max-w-lg"
              style={{ color: 'rgba(255,255,255,0.45)', lineHeight: '1.5' }}
            >
              Independent barbers do not need more hustle. They need a system.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.24, ease: 'easeOut' }}
              className="flex flex-col sm:flex-row gap-4 sm:gap-5 mb-8"
            >
              <a
                href="/signup"
                className="inline-flex items-center justify-center font-semibold px-8 py-3.5 rounded-full 
                           shadow-lg transition-all duration-200 
                           hover:scale-105 hover:shadow-xl
                           focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black"
                style={{
                  backgroundColor: COLORS.green,
                  color: '#000000',
                  boxShadow: `0 4px 20px -4px ${COLORS.greenGlow}`,
                }}
              >
                Start 21-Day Free Trial
              </a>

              <button
                onClick={scrollToHowItWorks}
                className="inline-flex items-center justify-center px-8 py-3.5 rounded-full 
                           border-2 transition-all duration-200 
                           hover:scale-105 cursor-pointer
                           focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black"
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
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
              className="text-xs sm:text-sm mb-3"
              style={{ color: COLORS.textSubtle }}
            >
              No credit card required. Takes 2 minutes.
            </motion.p>

            <motion.a
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.35, ease: 'easeOut' }}
              href="/login"
              className="text-sm hover:underline transition-all inline-block
                         focus:outline-none focus:underline"
              style={{ color: COLORS.textSubtle }}
            >
              Already have an account?{' '}
              <span className="font-semibold" style={{ color: COLORS.green }}>
                Sign in
              </span>
            </motion.a>

            <motion.a
              href="mailto:support@corva.ca"
              initial={{ opacity: 0, y: 0, scale: 1 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              whileHover={{ scale: 1 }}
              className="block text-xs sm:text-sm mt-6 mb-3 cursor-pointer"
              style={{ color: COLORS.textSubtle }}
            >
              Contact Us
            </motion.a>

          </div>

          {/* Right Column - Mockup */}
          <div className="relative">
            <MockupCard />
          </div>
        </div>
      </div>
    </section>
  )
}
