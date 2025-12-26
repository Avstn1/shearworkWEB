'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '@/components/Navbar';
import OnboardingGuard from '@/components/Wrappers/OnboardingGuard';
import SMSAutoNudge from '@/components/Dashboard/ClientManager/SMSAutoNudge/SMSAutoNudge'
import SMSCampaigns from '@/components/Dashboard/ClientManager/SMSCampaigns/SMSCampaigns';
import ClientSheets from '@/components/Dashboard/ClientManager/ClientSheets';
import UnderConstructionWrapper from '@/components/Wrappers/UnderConstructionWrapper';

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number = 1) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
};

export default function ClientManagerPage() {
  const [activeView, setActiveView] = useState<'sheets' | 'sms' | 'sms-campaign'>('sheets');

  return (
    <OnboardingGuard>
      <Navbar />
      <div className="min-h-screen flex flex-col p-4 text-[var(--foreground)] pt-[100px] bg-gradient-to-br from-[#101312] via-[#1a1f1b] to-[#2e3b2b]">
        {/* Header */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-200 to-lime-300 bg-clip-text text-transparent animate-gradient">
                Client Manager
              </h1>
              <p className="text-xs text-[#bdbdbd]">
                Manage your clients, appointments, and communications
              </p>
            </div>

            {/* View Switcher */}
            <div className="flex gap-1 w-full sm:w-auto bg-[#1a1a1a] rounded-full p-1">
              <button
                onClick={() => setActiveView('sheets')}
                className={`flex-1 sm:flex-none px-5 py-3 rounded-full text-xs font-semibold transition-all duration-300 whitespace-nowrap ${
                  activeView === 'sheets'
                    ? 'bg-lime-300 text-black shadow-[0_0_8px_#c4ff85]'
                    : 'text-[#bdbdbd] hover:text-white hover:bg-[#2a2a2a]'
                }`}
              >
                Client Sheets
              </button>
              <button
                onClick={() => setActiveView('sms')}
                className={`flex-1 sm:flex-none px-5 py-3 rounded-full text-xs font-semibold transition-all duration-300 whitespace-nowrap ${
                  activeView === 'sms'
                    ? 'bg-sky-300 text-black shadow-[0_0_8px_#7fd9ff]'
                    : 'text-[#bdbdbd] hover:text-white hover:bg-[#2a2a2a]'
                }`}
              >
                SMS Auto Nudge
              </button>
              <button
                onClick={() => setActiveView('sms-campaign')}
                className={`flex-1 sm:flex-none px-5 py-3 rounded-full text-xs font-semibold transition-all duration-300 whitespace-nowrap ${
                  activeView === 'sms-campaign'
                    ? 'bg-sky-300 text-black shadow-[0_0_8px_#7fd9ff]'
                    : 'text-[#bdbdbd] hover:text-white hover:bg-[#2a2a2a]'
                }`}
              >
                SMS Campaigns
              </button>
            </div>
          </div>
        </motion.div>

        {/* Content Area */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
            className="flex-1"
          >
            {activeView === 'sheets' && (
              <div className="bg-white/10 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 h-full">
                <UnderConstructionWrapper>
                  <ClientSheets />
                </UnderConstructionWrapper>
              </div>
            )}

            {activeView === 'sms' && (
              <UnderConstructionWrapper>
                <SMSAutoNudge />
              </UnderConstructionWrapper>
            )}

            {activeView === 'sms-campaign' && (
              <UnderConstructionWrapper>
                <SMSCampaigns />
              </UnderConstructionWrapper>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </OnboardingGuard>
  );
}