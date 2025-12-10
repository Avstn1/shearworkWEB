'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '@/components/Navbar';
import OnboardingGuard from '@/components/Wrappers/OnboardingGuard';
import SMSManager from '@/components/Dashboard/ClientManager/SMSManager/SMSManager'

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number = 1) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
};

export default function ClientManagerPage() {
  const [activeView, setActiveView] = useState<'sheets' | 'sms'>('sheets');

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
                SMS Manager
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
              <div className="bg-white/10 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl p-12 text-center h-full flex items-center justify-center">
                <div className="max-w-md mx-auto">
                  <div className="w-16 h-16 bg-lime-300/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-lime-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-white mb-2">
                    Client Sheets
                  </h2>
                  <p className="text-[#bdbdbd]">
                    View and manage detailed client information, visit history, and preferences.
                  </p>
                </div>
              </div>
            )}

            {activeView === 'sms' && (
              <SMSManager />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </OnboardingGuard>
  );
}