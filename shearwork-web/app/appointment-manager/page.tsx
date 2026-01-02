'use client';

import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import OnboardingGuard from '@/components/Wrappers/OnboardingGuard';
import AppointmentSheets from '@/components/Dashboard/AppointmentManager/AppointmentSheets';
import UnderConstructionWrapper from '@/components/Wrappers/UnderConstructionWrapper';

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number = 1) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
};

export default function AppointmentManagerPage() {
  return (
    <OnboardingGuard>
      <div className="min-h-screen flex flex-col px-3 sm:px-4 md:px-6 text-[var(--foreground)] pt-[80px] sm:pt-[100px] pb-6 bg-gradient-to-br from-[#101312] via-[#1a1f1b] to-[#2e3b2b]">
        {/* Header */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="mb-4 sm:mb-6"
        >
          <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-amber-200 to-orange-300 bg-clip-text text-transparent animate-gradient">
            Appointment Manager
          </h1>
          <p className="text-[10px] sm:text-xs text-[#bdbdbd] mt-0.5">
            View daily appointments, manage tips, and track revenue
          </p>
        </motion.div>

        {/* Content Area */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          custom={1}
          className="flex-1"
        >
          <div className="bg-white/10 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl p-3 sm:p-4 md:p-6 lg:p-8 h-full">
            <AppointmentSheets />
          </div>
        </motion.div>
      </div>
    </OnboardingGuard>
  );
}