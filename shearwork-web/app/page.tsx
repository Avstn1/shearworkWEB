'use client'

import Link from 'next/link'
import React from 'react'

export default function LandingPage() {
  return (
    <main className="relative min-h-screen flex flex-col text-[var(--foreground)] font-sans overflow-hidden">
      {/* Background image with soft overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('/barbershop-bg.jpg')", // replace with your static asset
          filter: 'brightness(0.4)',
        }}
      />
      <div className="absolute inset-0 bg-[var(--background)]/30 backdrop-blur-[2px]" />

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center justify-center flex-grow text-center px-6 py-20">
        <h1 className="text-6xl md:text-7xl font-extrabold mb-6 text-[var(--highlight)] drop-shadow-[0_3px_8px_rgba(0,0,0,0.6)]">
          ✂️ ShearWork
        </h1>
        <p className="text-xl md:text-2xl text-[var(--text-bright)]/90 max-w-2xl mb-10 leading-relaxed">
          The all-in-one scheduling, analytics, and client management platform for modern barbers.
        </p>

        <div className="flex gap-4">
          <Link
            href="/signup"
            className="bg-[var(--highlight)] hover:bg-[var(--accent-1)] text-[var(--accent-4)] font-semibold px-8 py-3 rounded-full shadow-lg transition-transform hover:scale-105"
          >
            Get Started
          </Link>
          <Link
            href="/login"
            className="border border-[var(--highlight)] text-[var(--highlight)] hover:text-[var(--accent-4)] hover:bg-[var(--highlight)] font-semibold px-8 py-3 rounded-full transition-transform hover:scale-105"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 py-28 px-6 bg-[var(--accent-4)] flex flex-col items-center">
        <h2 className="text-4xl md:text-5xl font-bold text-[var(--highlight)] mb-14 tracking-tight">
          What Makes ShearWork Different
        </h2>

        <div className="max-w-6xl mx-auto grid gap-8 md:grid-cols-3 w-full text-[var(--accent-4)]">
          {[
            {
              title: 'Smart Scheduling',
              desc: 'Manage appointments effortlessly with drag-and-drop ease.',
              icon: '🗓️',
            },
            {
              title: 'Business Insights',
              desc: 'Track revenue and performance in real time.',
              icon: '📊',
            },
            {
              title: 'Client Retention',
              desc: 'Automate follow-ups and build lasting relationships.',
              icon: '💬',
            },
          ].map((feature, i) => (
            <div
              key={i}
              className="group relative bg-[var(--accent-3)]/80 border border-[var(--accent-1)]/30 backdrop-blur-md rounded-2xl p-8 shadow-lg hover:shadow-[0_0_20px_var(--highlight)] transition-all duration-300 hover:-translate-y-1"
            >
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-2xl font-semibold mb-3 text-[var(--highlight)] group-hover:text-[var(--text-bright)] transition-colors">
                {feature.title}
              </h3>
              <p className="text-[var(--text-muted)] leading-relaxed">
                {feature.desc}
              </p>

              {/* Subtle glow effect */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-10 bg-[var(--highlight)] rounded-2xl blur-2xl transition-opacity"></div>
            </div>
          ))}
        </div>
      </section>


      {/* CTA */}
      <section className="relative z-10 py-24 px-6 bg-[var(--accent-4)] text-center">
        <h2 className="text-4xl font-bold text-[var(--highlight)] mb-6">Ready to streamline your barbershop?</h2>
        <p className="text-[var(--text-muted)] mb-8 text-lg">
          Join hundreds of barbers saving time and growing their business with ShearWork.
        </p>
        <Link
          href="/signup"
          className="bg-[var(--highlight)] hover:bg-[var(--accent-1)] text-[var(--accent-4)] font-semibold px-10 py-4 rounded-full shadow-lg transition-transform hover:scale-105"
        >
          Create Your Free Account
        </Link>
      </section>

      <footer className="py-6 text-center text-[var(--text-muted)] text-sm bg-[var(--accent-4)]/90">
        © {new Date().getFullYear()} ShearWork. All rights reserved.
      </footer>
    </main>
  )
}
