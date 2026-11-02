'use client'

import { motion } from 'framer-motion'
import { BarChart3, BellRing, Check, Link2, MessageSquareText, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'

const features: Array<{ title: string; desc: string; Icon: LucideIcon }> = [
  { title: 'Auto-Fill Engine', desc: 'Recover open spots automatically.', Icon: Zap },
  { title: 'Smart Client Reminders', desc: 'Reach past clients at the right time.', Icon: MessageSquareText },
  { title: 'Booking Alerts', desc: 'Know the moment someone books.', Icon: BellRing },
  { title: 'Simple Performance Insights', desc: 'See what works without the noise.', Icon: BarChart3 },
  { title: 'Booking Integration', desc: 'Connect Acuity or Square.', Icon: Link2 },
]

const planFeatures = ['Auto-Fill your empty slots', 'Smart booking reminders', 'Real-time booking alerts', 'Weekly performance insights']

function IconTile({ Icon }: { Icon: LucideIcon }) {
  return (
    <span className="relative mb-2 md:mb-4 grid h-8 w-8 md:h-11 md:w-11 place-items-center rounded-lg bg-gradient-to-br from-sage/20 to-sage/5 text-sage ring-1 ring-inset ring-sage/25 shadow-[0_0_24px_-8px_rgb(197_242_122/0.6)] transition duration-300 group-hover:shadow-[0_0_30px_-6px_rgb(197_242_122/0.85)]">
      <Icon className="h-4 w-4 md:h-5 md:w-5" strokeWidth={1.75} aria-hidden="true" />
    </span>
  )
}

export default function FeaturesAndPricing() {
  return (
    <section
      id="how-it-works"
      className="relative bg-canvas h-screen flex items-center justify-center px-4 md:px-6 lg:px-8 overflow-hidden text-ivory"
    >
      <div className="aurora-bg" />
      {/* Olive light behind the pricing card */}
      <div className="pointer-events-none absolute right-[-10%] top-1/2 h-[700px] w-[700px] -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(98_138_42/0.35),transparent)] blur-2xl" />

      <div className="relative max-w-7xl mx-auto w-full flex flex-col md:flex-row gap-4 md:gap-8 lg:gap-12 items-center justify-center">

        {/* LEFT — FEATURES */}
        <div className="w-full md:flex-[1.1] flex flex-col justify-center">
          <motion.h2
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="font-display text-base md:text-2xl lg:text-4xl font-semibold tracking-[-0.04em] mb-2 md:mb-6"
          >
            How Corva Makes You More Money
          </motion.h2>

          <div className="grid grid-cols-2 gap-2.5 md:gap-4">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
                className={i === features.length - 1 ? 'col-span-2' : ''}
              >
                <div className="group glass-card glass-card-hover h-full p-2.5 md:p-5 lg:p-6 rounded-lg md:rounded-xl">
                  <IconTile Icon={f.Icon} />
                  <h3 className="text-[11px] md:text-sm lg:text-base font-semibold text-ivory">{f.title}</h3>
                  <p className="text-[9px] md:text-xs lg:text-sm leading-tight md:leading-relaxed text-muted">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* DIVIDER (desktop only) */}
        <div className="hidden md:block w-px h-52 md:h-64 lg:h-96 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

        {/* RIGHT — PRICING */}
        <div className="w-full md:flex-1 flex flex-col justify-center">
          <motion.h2
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="font-display text-base md:text-2xl lg:text-4xl font-semibold tracking-[-0.04em] mb-2 md:mb-6"
          >
            Pricing
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="glass-panel relative overflow-hidden p-3 md:p-6 lg:p-8 flex flex-col shadow-[0_40px_80px_-40px_rgb(0_0_0/0.9),0_0_90px_-30px_rgb(197_242_122/0.45)]">
              {/* top sheen */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sage-bright/60 to-transparent" />
              <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-[radial-gradient(closest-side,rgb(197_242_122/0.22),transparent)]" />

              <div className="relative flex items-center justify-between mb-1 md:mb-4">
                <h3 className="text-sm md:text-lg lg:text-xl font-semibold">Corva Pro</h3>
                <span className="rounded-md border border-sage/20 bg-sage/10 px-2 py-1 text-[9px] md:text-[11px] font-semibold text-sage">
                  21-day free trial
                </span>
              </div>

              <div className="relative flex items-baseline gap-1 md:gap-2 mb-2 md:mb-5">
                <p className="font-display text-2xl md:text-5xl lg:text-6xl font-semibold tracking-[-0.05em] text-ivory">
                  $20
                </p>
                <span className="text-xs md:text-sm lg:text-base text-muted">/month</span>
              </div>

              <ul className="relative space-y-1 md:space-y-2.5 mb-3 md:mb-6">
                {planFeatures.map(feature => (
                  <li key={feature} className="flex items-center gap-1.5 md:gap-2.5">
                    <span className="grid h-3.5 w-3.5 md:h-5 md:w-5 place-items-center rounded-[4px] bg-sage text-ink">
                      <Check className="h-2 w-2 md:h-3 md:w-3" strokeWidth={3} aria-hidden="true" />
                    </span>
                    <span className="text-[10px] md:text-sm text-gray-200">{feature}</span>
                  </li>
                ))}
              </ul>

              <ButtonLink href="/signup" arrow className="relative w-full justify-between">
                Start 21-Day Free Trial
              </ButtonLink>
              <p className="relative mt-2 md:mt-3 text-[10px] md:text-xs text-muted">No credit card required</p>
            </div>
          </motion.div>
        </div>

      </div>
    </section>
  )
}
