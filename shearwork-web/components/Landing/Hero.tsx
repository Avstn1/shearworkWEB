'use client'

import { motion } from 'framer-motion'
import { BookingToast, SmsNotice } from './GlassNotice'
import { ButtonLink } from '@/components/ui/Button'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// A week of slots: 1 = booked, 0 = open (what Corva fills)
const WEEK = [
  [1, 1, 0, 1, 0, 1],
  [0, 1, 1, 0, 1, 1],
  [1, 0, 1, 1, 1, 0],
  [1, 1, 0, 0, 1, 1],
  [0, 1, 1, 1, 0, 1],
]

const FACTS = [
  { value: '21 days', label: 'free trial, no card' },
  { value: '$20', label: 'per month after' },
  { value: 'Acuity · Square', label: 'syncs your calendar' },
]

/** Stylised week view: booked slots solid, open slots dashed in lime. */
function ScheduleCard({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`glass-card ${compact ? 'p-4' : 'p-5 sm:p-6'}`}>
      <div className="flex items-center justify-between">
        <span className={`font-semibold text-ivory ${compact ? 'text-[13px]' : 'text-[15px]'}`}>This week</span>
        <span className="rounded-md bg-sage/10 px-2 py-1 text-[11px] font-semibold text-sage">Auto-filling</span>
      </div>
      <div className={`grid grid-cols-6 gap-2 ${compact ? 'mt-3 mb-2' : 'mt-5 mb-3'}`}>
        {DAYS.map(d => (
          <span key={d} className="text-center font-display text-[10px] uppercase tracking-[0.14em] text-gray-500">{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-6 gap-2">
        {WEEK.flat().map((booked, i) =>
          booked ? (
            <span key={i} className={`${compact ? 'h-5' : 'h-7'} rounded-[5px] bg-white/[0.07]`} />
          ) : (
            <span
              key={i}
              className={`${compact ? 'h-5' : 'h-7'} rounded-[5px] border-[1.5px] border-dashed border-sage/60 bg-sage/[0.04]`}
            />
          ),
        )}
      </div>
    </div>
  )
}

/** Desktop visual: schedule card with the Corva SMS and the booking toast floating over it. */
function HeroVisual() {
  return (
    <div className="relative mx-auto h-[520px] w-full max-w-[520px]">

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.25, ease: 'easeOut' }}
        className="absolute left-0 top-[150px] w-[400px]"
      >
        <ScheduleCard />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.6, ease: 'easeOut' }}
        className="absolute right-[-12px] top-0 w-[320px]"
      >
        <SmsNotice />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.9, ease: 'easeOut' }}
        className="absolute bottom-[10px] right-[10px] w-[320px]"
      >
        <BookingToast />
      </motion.div>
    </div>
  )
}

/** Mobile visual: the same story stacked. */
function MobileHeroVisual() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3, ease: 'easeOut' }}
      className="relative mx-auto w-full max-w-[340px]"
    >
      <div className="relative z-10 -mb-3 px-3">
        <SmsNotice size="sm" compact />
      </div>
      <ScheduleCard compact />
      <div className="relative z-10 -mt-4 px-5">
        <BookingToast size="sm" />
      </div>
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
    <section className="relative w-full text-ivory">

      <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-10 pt-20 sm:px-8 sm:pt-24 lg:px-16 lg:pb-20 lg:pt-24">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:gap-12">

          {/* Copy */}
          <div className="max-w-2xl">
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="mb-6 inline-flex items-center gap-2.5 rounded-md border border-white/[0.09] bg-white/[0.04] py-1.5 pl-2 pr-3.5 text-[12.5px] text-gray-300 backdrop-blur-md sm:mb-8"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sage opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-sage" />
              </span>
              Auto-Nudge for independent barbers
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="mb-6 font-display text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.045em] sm:mb-7 sm:text-6xl lg:text-[3.25rem] xl:text-[3.6rem]"
            >
              Stop relying on hustle{' '}
              <br className="hidden lg:block" />
              to <span className="text-gradient-aurora">stay booked.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.12, ease: 'easeOut' }}
              className="mb-4 max-w-xl text-base leading-relaxed text-gray-300 sm:text-lg lg:text-xl"
            >
              Corva detects your open spots and automatically reminds past clients so you recover bookings you would have missed.
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.18, ease: 'easeOut' }}
              className="mb-8 max-w-lg text-sm text-gray-500 sm:text-base lg:mb-9"
            >
              Independent barbers do not need more hustle. They need a system.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.24, ease: 'easeOut' }}
              className="mb-5 flex flex-col gap-3 sm:flex-row sm:gap-4"
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
              className="text-xs text-gray-500 sm:text-sm"
            >
              No credit card required · Takes 2 minutes ·{' '}
              <a href="/login" className="font-semibold text-sage hover:text-sage-bright focus:outline-none focus-visible:underline">
                Sign in
              </a>
            </motion.p>

            <motion.dl
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4, ease: 'easeOut' }}
              className="mt-8 hidden max-w-xl grid-cols-3 border-t border-white/[0.08] pt-6 sm:grid"
            >
              {FACTS.map(f => (
                <div key={f.label}>
                  <dt className="whitespace-nowrap font-display text-xl font-semibold tracking-[-0.03em] text-ivory lg:text-2xl">{f.value}</dt>
                  <dd className="mt-1 text-xs text-gray-500">{f.label}</dd>
                </div>
              ))}
            </motion.dl>

            <div className="mt-10 block lg:hidden">
              <MobileHeroVisual />
            </div>
          </div>

          {/* Visual */}
          <div className="relative hidden lg:block">
            <HeroVisual />
          </div>
        </div>
      </div>
    </section>
  )
}
