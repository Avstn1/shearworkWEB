'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { BookingToast, SmsNotice } from './GlassNotice'
import { ButtonLink } from '@/components/ui/Button'

const COLORS = {
  text: '#F4F3EC',
  textMuted: 'rgba(244, 243, 236, 0.66)',
  textSubtle: 'rgba(244, 243, 236, 0.5)',
  green: '#aab39a',
  greenGlow: 'rgba(170, 179, 154, 0.3)',
}

function SmsBubble() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.6, ease: 'easeOut' }}
      className="absolute top-[-60px] left-1/2 -translate-x-1/2 w-[250px] sm:w-[280px] lg:w-[310px] z-20"
    >
      <SmsNotice />
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
    >
      <BookingToast />
    </motion.div>
  )
}

function MobileSmsBubble() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: 0.5, ease: 'easeOut' }}
      className="absolute top-[-50px] left-1/2 -translate-x-1/2 w-[200px] sm:w-[220px] z-20 pointer-events-none"
    >
      <SmsNotice size="sm" compact />
    </motion.div>
  )
}

function MobileSuccessToast() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: 0.7, ease: 'easeOut' }}
      className="absolute bottom-[8px] left-1/2 -translate-x-1/2 w-[180px] sm:w-[200px] z-20 pointer-events-none"
    >
      <BookingToast size="sm" />
    </motion.div>
  )
}

function CroppedMobileMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3, ease: 'easeOut' }}
      className="relative w-full max-w-[280px] sm:max-w-[300px] mx-auto"
    >
      {/* Emerald glow behind phone */}
      <div 
        className="absolute inset-0 -z-10 rounded-t-[28px] blur-2xl"
        style={{ background: 'rgba(142, 154, 120,0.1)' }}
      />

      {/* Phone shell - cropped, rounded top only */}
      <div 
        className="relative rounded-t-[28px] rounded-b-none overflow-hidden border border-white/10 border-b-0 bg-white/5 backdrop-blur"
        style={{ boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)' }}
      >
        {/* Inner highlight - top edge shine */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none z-20" />

        {/* Fixed height container for crop effect */}
        <div className="relative h-[220px] sm:h-[240px] overflow-hidden">
          
          {/* Blurred calendar background */}
          <Image
            src="/heroImages/corva-calendar.png"
            alt=""
            width={267}
            height={414}
            className="absolute inset-0 w-full h-auto object-cover object-top"
            style={{ 
              filter: 'grayscale(1) sepia(0.35) hue-rotate(38deg) saturate(0.9) brightness(0.62) contrast(1.05) blur(3px)',
              transform: 'scale(1.02)'
            }}
            quality={90}
          />

          {/* SMS notification bubbles - inside phone */}
          <div className="absolute inset-x-4 top-4 space-y-3 z-10">
            
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.5, ease: 'easeOut' }}
            >
              <SmsNotice size="sm" compact />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.8, ease: 'easeOut' }}
            >
              <BookingToast size="sm" />
            </motion.div>

          </div>

          {/* Bottom gradient fade - fades phone into hero background */}
          <div 
            className="absolute inset-x-0 bottom-0 h-[80px] pointer-events-none z-10"
            style={{
              background: 'linear-gradient(to bottom, transparent 0%, rgba(14,17,12,0.6) 40%, rgba(14,17,12,1) 100%)'
            }}
          />

        </div>
      </div>
    </motion.div>
  )
}

function MobileMockupCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3, ease: 'easeOut' }}
      className="relative w-full max-w-[260px] sm:max-w-[280px] mx-auto"
    >
      {/* Glow behind the card */}
      <div className="absolute inset-0 rounded-[24px] blur-xl bg-emerald-500/8 -z-10" />

      {/* Device/Card Shell */}
      <div
        className="relative rounded-[24px] border border-white/10 bg-white/5 p-3 sm:p-4 backdrop-blur"
        style={{
          boxShadow: '0 20px 80px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Shell highlight */}
        <div className="pointer-events-none absolute inset-0 rounded-[24px] bg-gradient-to-b from-white/10 via-white/5 to-transparent" />
        
        {/* Shell vignette */}
        <div className="pointer-events-none absolute inset-0 rounded-[24px] bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_20%,rgba(0,0,0,0.3)_100%)]" />

        {/* CONTENT AREA */}
        <div className="relative w-full overflow-hidden rounded-[14px] border border-white/10">
          <Image
            src="/heroImages/corva-calendar.png"
            alt="Schedule"
            width={267}
            height={414}
            className="w-full h-auto"
            quality={90}
            style={{ filter: 'grayscale(1) sepia(0.35) hue-rotate(38deg) saturate(0.9) brightness(0.62) contrast(1.05) blur(2.5px)' }}
          />

          {/* Inner card frame */}
          <div className="pointer-events-none absolute inset-0 rounded-[14px] ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]" />
          
          {/* Top fog */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[46%] bg-gradient-to-b from-white/[0.16] via-white/[0.06] to-transparent" />
          
          {/* Bottom fade */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-t from-black/20 to-transparent" />
        </div>
      </div>

      {/* SMS Bubble - outside the shell so it can overflow */}
      <MobileSmsBubble />

      {/* Success Toast - outside the shell so it can overflow */}
      <MobileSuccessToast />
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
            style={{ filter: 'grayscale(1) sepia(0.35) hue-rotate(38deg) saturate(0.9) brightness(0.62) contrast(1.05) blur(2.5px)' }}
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
      className="w-full relative overflow-hidden"
      style={{
        background: 'radial-gradient(120% 90% at 85% 15%, #1E241A 0%, #12150F 45%, #0B0D09 100%)',
        color: COLORS.text,
      }}
    >
      {/* Vignette overlay - darkened edges */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_70%_70%_at_50%_50%,rgba(0,0,0,0)_0%,rgba(0,0,0,.6)_70%,rgba(0,0,0,.85)_100%)]" />

      {/* Emerald blob - top left (soft, pushed away from text) */}
      <div className="absolute -top-40 -left-60 w-[600px] h-[600px] rounded-full blur-[120px] bg-olive/25 pointer-events-none" />

      {/* Emerald blob - right side (stronger, behind mockup) */}
      <div className="absolute top-1/4 -right-20 w-[800px] h-[800px] rounded-full blur-[140px] bg-[radial-gradient(closest-side,rgb(93_106_72/0.45),transparent)] pointer-events-none" />

      {/* Dark pocket behind text for maximum contrast */}
      <div className="absolute left-0 top-0 w-[55%] h-full pointer-events-none bg-gradient-to-r from-black/60 via-black/30 to-transparent" />

      {/* Main content */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-8 lg:px-16 pt-20 sm:pt-24 lg:pt-36 pb-8 sm:pb-12 lg:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_0.7fr] gap-12 lg:gap-20 xl:gap-28 items-center">
          
          {/* Left Column - Copy (DOMINANT) */}
          <div className="max-w-2xl">
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="mb-6 sm:mb-8 inline-flex items-center gap-2.5 rounded-full border border-white/[0.09] bg-white/[0.04] py-1.5 pl-2 pr-3.5 text-[12.5px] text-gray-300 backdrop-blur-md shadow-[inset_0_1px_0_rgb(247_245_239/0.06)]"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sage opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-sage-bright" />
              </span>
              Auto-Nudge for independent barbers
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="text-4xl sm:text-5xl lg:text-7xl font-semibold mb-6 sm:mb-8 lg:mb-10 tracking-[-0.035em] text-ivory"
              style={{ lineHeight: '1.04' }}
            >
              <span className="sm:whitespace-nowrap">Stop Relying on Hustle</span>
              <br />
              <span className="sm:whitespace-nowrap bg-gradient-to-r from-ivory via-sage-bright to-sage bg-clip-text text-transparent">to Stay Booked.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.12, ease: 'easeOut' }}
              className="text-base sm:text-lg lg:text-2xl mb-4 sm:mb-6 lg:mb-8 max-w-xl"
              style={{ color: COLORS.textMuted, lineHeight: '1.6' }}
            >
              Corva detects your open spots and automatically reminds past clients so you recover bookings you would have missed.
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.18, ease: 'easeOut' }}
              className="text-sm sm:text-base lg:text-lg mb-6 sm:mb-8 lg:mb-12 max-w-lg"
              style={{ color: COLORS.textSubtle, lineHeight: '1.5' }}
            >
              Independent barbers do not need more hustle. They need a system.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.24, ease: 'easeOut' }}
              className="flex flex-col sm:flex-row gap-4 sm:gap-5 mb-4 sm:mb-6 lg:mb-8"
            >
              <ButtonLink href="/signup" size="lg" arrow>
                Start 21-Day Free Trial
              </ButtonLink>

              <button type="button" onClick={scrollToHowItWorks} className="btn btn-glass btn-lg">
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

            {/* Mobile Preview - visible on mobile only */}
            <div className="block lg:hidden mt-8 sm:mt-10">
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="text-center text-[10px] uppercase tracking-[0.2em] mb-4"
                style={{ color: COLORS.textSubtle }}
              >
                Preview
              </motion.p>
              <CroppedMobileMockup />
            </div>

          </div>

          {/* Right Column - Mockup (hidden on mobile) */}
          <div className="relative hidden lg:block">
            <MockupCard />
          </div>
        </div>
      </div>
    </section>
  )
}
