'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '@/components/Navbar';
import OnboardingGuard from '@/components/Wrappers/OnboardingGuard';
import SMSAutoNudge from '@/components/Dashboard/ClientManager/SMSAutoNudge/SMSAutoNudge'
import SMSAutoNudge_SmartBucket from '@/components/Dashboard/ClientManager/SMSAutoNudge/SMSAutoNudge_SmartBucket'
import SMSCampaigns from '@/components/Dashboard/ClientManager/SMSCampaigns/SMSCampaigns';
import ClientSheets from '@/components/Dashboard/ClientManager/ClientSheets';
import UnderConstructionWrapper from '@/components/Wrappers/UnderConstructionWrapper';
import FAQModal from '@/components/Dashboard/ClientManager/FAQModal';
import TutorialLauncher from '@/components/Tutorial/TutorialLauncher'
import TutorialInfoButton from '@/components/Tutorial/TutorialInfoButton'
import { CLIENT_MANAGER_TUTORIAL_STEPS } from '@/lib/tutorials/client-manager'

type ViewType = 'sheets' | 'sms' | 'sms-campaign';

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number = 1) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
};

export default function ClientManagerPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const viewParam = searchParams.get('view');
  
  // Derive active view from URL param (URL is source of truth for initial load)
  const getActiveView = (): ViewType => {
    if (viewParam === 'sms' || viewParam === 'auto-nudge') return 'sms';
    if (viewParam === 'sms-campaign' || viewParam === 'campaigns') return 'sms-campaign';
    return 'sheets';
  };

  // Use URL-derived view, but allow local override via state for tab clicks
  const [localView, setLocalView] = useState<ViewType | null>(null);
  const [showFAQ, setShowFAQ] = useState(false);
  
  // If user hasn't clicked a tab yet, use URL param; otherwise use their selection
  const activeView = localView ?? getActiveView();
  
  // When user clicks a tab, update local state (clears URL influence)
  const handleSetView = (view: ViewType) => {
    setLocalView(view);
    // Optionally update URL to match (keeps URL in sync)
    router.replace(`/client-manager?view=${view}`, { scroll: false });
  };

  return (
    <OnboardingGuard>
      <div className="min-h-screen flex flex-col px-3 sm:px-4 md:px-6 text-[var(--foreground)] pt-[80px] sm:pt-[100px] pb-6 bg-gradient-to-br from-[#101312] via-[#1a1f1b] to-[#2e3b2b]">
        {/* Header */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="mb-4 sm:mb-6 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 sm:gap-4"
        >
          {/* Left side: Title and View Switcher */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
            {/* Title */}
            <div>
              <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-amber-200 to-lime-300 bg-clip-text text-transparent animate-gradient">
                Client Manager
              </h1>
              <p className="text-[10px] sm:text-xs text-[#bdbdbd] mt-0.5">
                Manage your clients, appointments, and communications
              </p>
            </div>

            {/* View Switcher */}
            <div data-tutorial-id="client-manager-tabs" className="flex gap-1 bg-[#1a1a1a] rounded-full p-1">
              <button
                onClick={() => handleSetView('sheets')}
                className={`flex-1 lg:flex-none px-3 sm:px-5 py-2 sm:py-3 rounded-full text-[10px] sm:text-xs font-semibold transition-all duration-300 whitespace-nowrap ${
                  activeView === 'sheets'
                    ? 'bg-lime-300 text-black shadow-[0_0_8px_#c4ff85]'
                    : 'text-[#bdbdbd] hover:text-white hover:bg-[#2a2a2a]'
                }`}
              >
                <span className="hidden xs:inline">Client Sheets</span>
                <span className="xs:hidden">Sheets</span>
              </button>
              <button
                onClick={() => handleSetView('sms')}
                className={`flex-1 lg:flex-none px-3 sm:px-5 py-2 sm:py-3 rounded-full text-[10px] sm:text-xs font-semibold transition-all duration-300 whitespace-nowrap ${
                  activeView === 'sms'
                    ? 'bg-sky-300 text-black shadow-[0_0_8px_#7fd9ff]'
                    : 'text-[#bdbdbd] hover:text-white hover:bg-[#2a2a2a]'
                }`}
              >
                <span className="hidden xs:inline">SMS Auto Nudge</span>
                <span className="xs:hidden">Auto Nudge</span>
              </button>
              <button
                onClick={() => handleSetView('sms-campaign')}
                className={`flex-1 lg:flex-none px-3 sm:px-5 py-2 sm:py-3 rounded-full text-[10px] sm:text-xs font-semibold transition-all duration-300 whitespace-nowrap ${
                  activeView === 'sms-campaign'
                    ? 'bg-sky-300 text-black shadow-[0_0_8px_#7fd9ff]'
                    : 'text-[#bdbdbd] hover:text-white hover:bg-[#2a2a2a]'
                }`}
              >
                <span className="hidden xs:inline">SMS Campaigns</span>
                <span className="xs:hidden">Campaigns</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <TutorialLauncher
              pageKey="client-manager"
              steps={CLIENT_MANAGER_TUTORIAL_STEPS}
              context={{
                setActiveView: (view) => handleSetView(view as ViewType),
              }}
              renderTrigger={(openTutorial) => (
                <TutorialInfoButton onClick={openTutorial} label="Client Manager tutorial" />
              )}
            />
            {/* FAQ Button */}
            <button
              onClick={() => setShowFAQ(true)}
              className="flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-full text-[10px] sm:text-xs font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 transition-all duration-300 shadow-lg hover:shadow-emerald-500/30 active:scale-95 sm:hover:scale-105 whitespace-nowrap"
            >
              <svg 
                className="w-3.5 h-3.5 sm:w-4 sm:h-4" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
              <span className="hidden xs:inline">Frequently Asked Questions</span>
              <span className="xs:hidden">Frequently Asked Questions</span>
            </button>
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
                <div data-tutorial-id="client-manager-sheets" className="bg-white/10 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl p-3 sm:p-4 md:p-6 lg:p-8 h-full">
                  <ClientSheets />
                </div>
              )}

            {activeView === 'sms' && (
              <div data-tutorial-id="client-manager-auto-nudge">
                {/* <SMSAutoNudge_SmartBucket /> */}
                <SMSAutoNudge />
              </div>
            )}

            {activeView === 'sms-campaign' && (
              <div data-tutorial-id="client-manager-campaigns">
                <SMSCampaigns />
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* FAQ Modal */}
        <FAQModal isOpen={showFAQ} onClose={() => setShowFAQ(false)} />
      </div>
    </OnboardingGuard>
  );
}
