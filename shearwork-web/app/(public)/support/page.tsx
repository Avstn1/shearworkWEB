'use client';

import { motion } from 'framer-motion';
import { Mail, HelpCircle, Clock } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Landing/Footer';

// ── Types ─────────────────────────────────────────────────────────────────────
interface SectionCardProps {
  icon: React.ReactNode;
  title: string;
  num: string;
  delay?: number;
  children: React.ReactNode;
}

// ── Sub-components ────────────────────────────────────────────────────────────
function SectionCard({ icon, title, num, delay = 0, children }: SectionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.45, delay, ease: 'easeOut' }}
      className="rounded-2xl mb-5 overflow-hidden border border-white/[0.09] bg-[#1a1a1a] hover:border-[#73aa57]/20 transition-colors duration-300"
    >
      <div className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.09]">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #73aa57 0%, #5b8f52 100%)',
            boxShadow: '0 4px 14px rgba(115,170,87,0.35)',
          }}
        >
          {icon}
        </div>
        <span className="flex-1 text-white font-bold text-[15px] tracking-tight">{title}</span>
        <span className="font-mono text-xs text-white/30">{num}</span>
      </div>

      <div className="px-6 py-6">{children}</div>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SupportPage() {
  return (
    <>
      <Navbar />

      <main
        className="min-h-screen relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #181818 0%, #1a1a1a 30%, #1c1e1c 70%, #181818 100%)' }}
      >
        {/* Ambient glow */}
        <div
          className="absolute top-[-80px] left-[-100px] w-72 h-72 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'rgba(115,170,87,0.4)', opacity: 0.1 }}
        />

        <div className="relative z-10 max-w-3xl mx-auto px-5 sm:px-6 pt-28 pb-24">

          {/* ── Hero ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="mb-12"
          >
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-4 bg-[rgba(115,170,87,0.08)] border border-[rgba(115,170,87,0.22)]">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: '#73aa57', boxShadow: '0 0 6px rgba(115,170,87,0.8)' }}
              />
              <span className="font-mono text-[11px] font-medium uppercase tracking-widest text-[#73aa57]">
                Support
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight leading-[1.1] mb-3">
              We're here to <span className="text-[#73aa57]">help.</span>
            </h1>

            <p className="text-sm text-white/55 max-w-lg">
              Have a question, issue, or need assistance with Corva AI?
              Our team responds quickly and is happy to help.
            </p>
          </motion.div>

          {/* ── 01 Contact ── */}
          <SectionCard
            icon={<HelpCircle size={16} color="#000" />}
            title="Need Help with Corva AI?"
            num="01"
            delay={0.1}
          >
            <p className="text-sm text-white/70 mb-4">
              Reach out to our support team directly via email.
            </p>

            <div className="rounded-xl p-4 bg-white/[0.03] border border-white/[0.09] mb-4">
              <p className="text-xs uppercase tracking-widest text-white/40 mb-1">
                Support Email
              </p>
              <a
                href="mailto:support@corva.ca"
                className="text-[#73aa57] font-semibold text-sm hover:underline"
              >
                support@corva.ca
              </a>
            </div>

            <div className="flex items-center gap-2 text-sm text-white/55">
              <Clock size={14} />
              Response within 24 hours.
            </div>
          </SectionCard>

          {/* ── Contact CTA ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
            className="rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 mt-4 border border-[rgba(115,170,87,0.25)]"
            style={{
              background:
                'linear-gradient(135deg, rgba(115,170,87,0.12) 0%, rgba(91,143,82,0.06) 100%)',
            }}
          >
            <div>
              <h3 className="text-white font-bold text-lg mb-1 tracking-tight">
                Still need assistance?
              </h3>
              <p className="text-sm text-white/55">
                Click below to contact us directly.
              </p>
            </div>

            <a
              href="mailto:support@corva.ca"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-black flex-shrink-0 transition-all duration-300 hover:scale-[1.03]"
              style={{
                background: 'linear-gradient(135deg, #73aa57 0%, #5b8f52 100%)',
                boxShadow: '0 6px 24px rgba(115,170,87,0.35)',
              }}
            >
              <Mail size={14} />
              Contact Us
            </a>
          </motion.div>

        </div>
      </main>

      <Footer />
    </>
  );
}