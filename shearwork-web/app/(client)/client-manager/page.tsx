'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import SMSAutoNudge from '@/components/Dashboard/ClientManager/SMSAutoNudge/SMSAutoNudge'
import SMSAutoNudge_SmartBucket from '@/components/Dashboard/ClientManager/SMSAutoNudge/SMSAutoNudge_SmartBucket'
import SMSCampaigns from '@/components/Dashboard/ClientManager/SMSCampaigns/SMSCampaigns';
import ClientSheets from '@/components/Dashboard/ClientManager/ClientSheets';
import { HelpCircle } from 'lucide-react';
import { AppPage, PageHeader, Segmented } from '@/components/ui/AppKit';
import FAQModal from '@/components/Dashboard/ClientManager/FAQModal';
import TutorialLauncher from '@/components/Tutorial/TutorialLauncher'
import TutorialInfoButton from '@/components/Tutorial/TutorialInfoButton'
import { CLIENT_MANAGER_TUTORIAL_STEPS } from '@/lib/tutorials/client-manager'
import { useAuth } from '@/contexts/AuthContext'

type ViewType = 'sheets' | 'sms' | 'sms-campaign';

export default function ClientManagerPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const viewParam = searchParams.get('view');

  const { profile } = useAuth()
  
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
    <AppPage className="flex flex-col">
      <PageHeader
        title="Client Manager"
        subtitle="Manage your clients, appointments, and communications"
        actions={
          <>
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
            <button
              type="button"
              onClick={() => setShowFAQ(true)}
              className="btn btn-glass btn-sm"
            >
              <HelpCircle size={16} strokeWidth={1.75} aria-hidden="true" />
              <span className="hidden sm:inline">Frequently Asked Questions</span>
              <span className="sm:hidden">FAQ</span>
            </button>
          </>
        }
      />

      {/* View Switcher */}
      <div data-tutorial-id="client-manager-tabs" className="mb-5">
        <Segmented<ViewType>
          className="w-full sm:w-auto"
          value={activeView}
          onChange={handleSetView}
          options={[
            {
              value: 'sheets',
              label: (
                <>
                  <span className="hidden sm:inline">Client Sheets</span>
                  <span className="sm:hidden">Sheets</span>
                </>
              ),
            },
            {
              value: 'sms',
              label: (
                <>
                  <span className="hidden sm:inline">SMS Auto Nudge</span>
                  <span className="sm:hidden">Auto Nudge</span>
                </>
              ),
            },
            {
              value: 'sms-campaign',
              label: (
                <>
                  <span className="hidden sm:inline">SMS Campaigns</span>
                  <span className="sm:hidden">Campaigns</span>
                </>
              ),
            },
          ]}
        />
      </div>

      {/* Content Area */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeView}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="flex-1"
        >
          {activeView === 'sheets' && (
            <div data-tutorial-id="client-manager-sheets">
              <ClientSheets />
            </div>
          )}

          {activeView === 'sms' && (
            <div data-tutorial-id="client-manager-auto-nudge">
              {profile?.special_access ? <SMSAutoNudge_SmartBucket /> : <SMSAutoNudge />}
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
    </AppPage>
  );
}
