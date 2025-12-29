'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, ChevronUp } from 'lucide-react';

interface FAQModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FAQItem {
  question: string;
  answer: string | React.ReactElement;
  section: 'overview' | 'sms-features';
}

interface FAQSection {
  id: string;
  title: string;
  description: string;
  color: string;
}

const faqSections: FAQSection[] = [
  {
    id: 'overview',
    title: 'Overview & Guidelines',
    description: 'Understanding cooldowns, limits, and message rules',
    color: 'from-slate-600 to-gray-700'
  },
  {
    id: 'sms-features',
    title: 'SMS Features Explained',
    description: 'Auto Nudge, Campaigns, and Mass Messages',
    color: 'from-slate-600 to-emerald-800'
  }
];

const faqs: FAQItem[] = [
  // OVERVIEW SECTION - General
  {
    question: "What are the different messaging types in ShearWork?",
    answer: (
      <div className="space-y-3">
        <p>ShearWork offers three ways to message your clients:</p>
        <ul className="space-y-2 ml-4">
          <li className="flex items-start gap-2">
            <span className="text-sky-400/80 mt-1">•</span>
            <div>
              <strong className="text-sky-400/90">SMS Auto Nudge:</strong> Automatically finds clients who are overdue for a visit and sends them friendly reminders to book again.
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-400/80 mt-1">•</span>
            <div>
              <strong className="text-amber-400/90">SMS Campaigns:</strong> Perfect for holidays or special promotions. Targets clients who haven't been in recently but are still engaged.
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-lime-400/80 mt-1">•</span>
            <div>
              <strong className="text-lime-400/90">Mass Messages:</strong> Send announcements to ALL your clients, like when you're closed for vacation or have a special event.
            </div>
          </li>
        </ul>
      </div>
    ),
    section: 'overview'
  },

  {
    question: "What are the different Client Types?",
    answer: (
      <div className="space-y-3">
        <p>ShearWork automatically categorizes your clients based on how often they visit. These categories help the messaging system find the right people to contact:</p>
        <div className="bg-white/5 rounded-lg p-4 space-y-3">
          <div>
            <h4 className="text-lime-400/90 font-semibold mb-1">Consistent</h4>
            <p className="text-sm text-gray-300">
              Visits more than once every 1 week and a few days on average (basically your regulars who come frequently)
            </p>
          </div>
          <div>
            <h4 className="text-amber-400/90 font-semibold mb-1">Semi-Consistent</h4>
            <p className="text-sm text-gray-300">
              Visits once every 2-3 weeks on average (reliable clients with a steady schedule)
            </p>
          </div>
          <div>
            <h4 className="text-sky-400/90 font-semibold mb-1">Easy-Going</h4>
            <p className="text-sm text-gray-300">
              Visits once every 3-8 weeks on average (casual clients who come when they need to)
            </p>
          </div>
          <div>
            <h4 className="text-gray-400 font-semibold mb-1">Rare</h4>
            <p className="text-sm text-gray-300">
              Visits less than once every 8 weeks on average (occasional clients)
            </p>
          </div>
          <div>
            <h4 className="text-purple-400/90 font-semibold mb-1">New</h4>
            <p className="text-sm text-gray-300">
              Only visited once so far (we don't know their pattern yet)
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-400">
          These categories are calculated automatically based on your client's actual visit history, so they update as their patterns change.
        </p>
      </div>
    ),
    section: 'overview'
  },

  // OVERVIEW SECTION - Cooldowns
  {
    question: "Why can't I message some clients even though they seem eligible?",
    answer: (
      <div className="space-y-3">
        <p className="text-orange-300/80">
          <strong>ShearWork has built-in cooldowns to prevent annoying your clients with too many messages.</strong>
        </p>
        <div className="bg-white/5 rounded-lg p-4 space-y-3">
          <div>
            <h4 className="text-sky-400/90 font-semibold mb-2">Auto Nudge Cooldown: 14 days</h4>
            <p className="text-sm">
              After a client receives an Auto Nudge, they won't get another one for at least 14 days, even if they're still overdue.
            </p>
          </div>
          <div>
            <h4 className="text-amber-400/90 font-semibold mb-2">Campaign Cooldown: 7 days</h4>
            <p className="text-sm">
              Campaigns wait 7 days after the last message before including a client again.
            </p>
          </div>
          <div>
            <h4 className="text-lime-400/90 font-semibold mb-2">Mass Message Cooldown: 15 days (lenient phase)</h4>
            <p className="text-sm">
              Mass messages have the longest cooldown since they go to everyone.
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-400">
          These cooldowns protect your reputation and prevent clients from feeling spammed!
        </p>
      </div>
    ),
    section: 'overview'
  },
  {
    question: "Why am I seeing fewer clients than expected?",
    answer: (
      <div className="space-y-3">
        <p>There are several reasons you might see fewer eligible clients:</p>
        <ul className="space-y-2 ml-4">
          <li className="flex items-start gap-2">
            <span className="text-orange-300">1.</span>
            <div>
              <strong>Recent Messages:</strong> Clients messaged recently are in cooldown period
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-orange-300">2.</span>
            <div>
              <strong>Visit Timing:</strong> Clients might not be overdue enough yet (Auto Nudge needs 14+ days overdue)
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-orange-300">3.</span>
            <div>
              <strong>Visit Patterns:</strong> Clients might visit too frequently or too rarely to qualify
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-orange-300">4.</span>
            <div>
              <strong>Phone Numbers:</strong> Some clients might not have valid phone numbers on file
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-orange-300">5.</span>
            <div>
              <strong>Unsubscribed:</strong> Clients who opted out won't appear
            </div>
          </li>
        </ul>
        <p className="text-sm bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mt-3">
          <strong>Pro tip:</strong> Check your message history to see when clients last received a message!
        </p>
      </div>
    ),
    section: 'overview'
  },

  // OVERVIEW SECTION - Message Locks
  {
    question: "Why is my Auto Nudge schedule locked?",
    answer: (
      <div className="space-y-3">
        <p className="text-amber-300/80">
          <strong>Auto Nudge schedules lock until the 1st of the next month</strong> after you activate them. This prevents accidental spam.
        </p>
        <p>Here's why:</p>
        <ul className="space-y-2 ml-4">
          <li className="flex items-start gap-2">
            <span className="text-sky-400/80">•</span>
            <span>Auto Nudge runs automatically based on your schedule</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-sky-400/80">•</span>
            <span>If you could change it anytime, you might accidentally message the same clients twice</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-sky-400/80">•</span>
            <span>The lock resets on the 1st of each month so you can adjust for the new month</span>
          </li>
        </ul>
        <p className="text-sm text-gray-400 mt-3">
          <em>Tip: Plan your Auto Nudge schedule carefully at the beginning of the month!</em>
        </p>
      </div>
    ),
    section: 'overview'
  },
  {
    question: "What happens to Campaign and Mass messages after I send them?",
    answer: (
      <div className="space-y-3">
        <p className="text-amber-300/80">
          <strong>Campaign and Mass messages are one-time use only.</strong>
        </p>
        <p>Here's what happens:</p>
        <ul className="space-y-2 ml-4">
          <li className="flex items-start gap-2">
            <span className="text-amber-400/80">•</span>
            <span>Once sent, you can't reuse the same message</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-400/80">•</span>
            <span>When you delete it, it's "soft deleted" - removed from your active list</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-400/80">•</span>
            <span>You can still see it in your message history for record-keeping</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-400/80">•</span>
            <span>Want another campaign or mass message? Just create a new one!</span>
          </li>
        </ul>
        <p className="text-sm text-gray-400 mt-3">
          This keeps your messages organized and prevents confusion about which messages are active.
        </p>
      </div>
    ),
    section: 'overview'
  },

  // SMS FEATURES SECTION - Auto Nudge
  {
    question: "How does SMS Auto Nudge decide who to message?",
    answer: (
      <div className="space-y-3">
        <p>Auto Nudge is smart about finding clients who are most likely to book again. Here's how it works:</p>
        <ul className="space-y-2 ml-4">
          <li className="flex items-start gap-2">
            <span className="text-sky-400/80">•</span>
            <span>It looks at each client's visit pattern (how often they usually come in)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-sky-400/80">•</span>
            <span>Calculates how many days "overdue" they are based on their usual schedule</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-sky-400/80">•</span>
            <span>Only messages clients who are at least <strong>14 days overdue</strong></span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-sky-400/80">•</span>
            <span>Heavily prioritizes your "consistent" and "semi-consistent" clients (90% of messages go to them)</span>
          </li>
        </ul>
        <p className="text-sm text-gray-400 mt-3">
          <em>Example: If John usually comes every 4 weeks and it's been 6 weeks, he's 2 weeks overdue and eligible for a nudge.</em>
        </p>
      </div>
    ),
    section: 'sms-features'
  },
  {
    question: "What client types get Auto Nudge messages?",
    answer: (
      <div className="space-y-3">
        <p>Auto Nudge focuses on your most reliable clients and tries to prioritize them whenever possible:</p>
        <ul className="space-y-2 ml-4">
          <li className="flex items-start gap-2">
            <span className="text-green-400/70">✓</span>
            <div>
              <strong className="text-lime-400/90">Consistent clients</strong> - Come in regularly (more than once every 1 week and a few days on average)
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400/70">✓</span>
            <div>
              <strong className="text-amber-400/90">Semi-consistent clients</strong> - Come in fairly regularly (every 2-3 weeks on average)
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-yellow-400/60">~</span>
            <div>
              <strong className="text-gray-300">Easy-going & Rare clients</strong> - May get messages if there aren't enough consistent/semi-consistent clients available
            </div>
          </li>
        </ul>
        <p className="text-sm bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mt-3">
          <strong>How it works:</strong> The system tries to fill 90% of Auto Nudge messages with Consistent and Semi-Consistent clients when possible. If there aren't enough of them available (due to cooldowns or visit timing), it will include Easy-Going and Rare clients to reach your target number.
        </p>
        <p className="text-sm text-gray-400 mt-3">
          The system skips clients who haven't visited in too long - they're better for Campaigns instead.
        </p>
      </div>
    ),
    section: 'sms-features'
  },

  // SMS FEATURES SECTION - Campaigns
  {
    question: "How does SMS Campaigns decide who to message?",
    answer: (
      <div className="space-y-3">
        <p>Campaigns use a two-phase approach to find the best clients for your promotion:</p>
        <div className="bg-white/5 rounded-lg p-4 space-y-3">
          <div>
            <h4 className="text-amber-400/90 font-semibold mb-2">Phase 1: High-Priority Clients</h4>
            <ul className="space-y-1 ml-4 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-amber-400/80">•</span>
                <span>Clients who are a bit overdue but not gone forever</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400/80">•</span>
                <span>Consistent clients: 0-45 days overdue</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400/80">•</span>
                <span>Semi-consistent: 0-30 days overdue</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400/80">•</span>
                <span>New clients: 21-60 days since their first visit</span>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sky-400/90 font-semibold mb-2">Phase 2: Fill the Gaps</h4>
            <p className="text-sm">
              If Phase 1 doesn't find enough people, we'll add more clients who are slightly more overdue (up to 120 days), giving you a fuller list for your campaign.
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-400">
          Campaigns are perfect for bringing back clients who might have forgotten about you!
        </p>
      </div>
    ),
    section: 'sms-features'
  },

  // SMS FEATURES SECTION - Mass Messages
  {
    question: "How does Mass Messages decide who to message?",
    answer: (
      <div className="space-y-3">
        <p>Mass Messages are the simplest - they go to <strong className="text-lime-400/90">EVERYONE!</strong></p>
        <p>Here's who gets included:</p>
        <ul className="space-y-2 ml-4">
          <li className="flex items-start gap-2">
            <span className="text-lime-400/80">•</span>
            <span>All clients with a phone number</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-lime-400/80">•</span>
            <span>Who have visited at least once</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-lime-400/80">•</span>
            <span>Haven't unsubscribed from messages</span>
          </li>
        </ul>
        <p className="text-sm bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mt-3">
          <strong className="text-yellow-400/90">Important:</strong> Mass messages don't filter by visit recency. Use these sparingly for important announcements only!
        </p>
      </div>
    ),
    section: 'sms-features'
  },
  {
    question: "When should I use Mass Messages vs Campaigns?",
    answer: (
      <div className="space-y-3">
        <div className="bg-lime-500/10 border border-lime-500/20 rounded-lg p-4">
          <h4 className="text-lime-400/90 font-semibold mb-2">Use Mass Messages for:</h4>
          <ul className="space-y-1 ml-4 text-sm">
            <li>• Shop closures or schedule changes</li>
            <li>• Important announcements everyone needs to know</li>
            <li>• Special events at your shop</li>
            <li>• Holiday greetings to all clients</li>
          </ul>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
          <h4 className="text-amber-400/90 font-semibold mb-2">Use Campaigns for:</h4>
          <ul className="space-y-1 ml-4 text-sm">
            <li>• Promotional offers or discounts</li>
            <li>• Bringing back clients who haven't been in</li>
            <li>• Seasonal promotions</li>
            <li>• New service announcements</li>
          </ul>
        </div>
      </div>
    ),
    section: 'sms-features'
  },
];


export default function FAQModal({ isOpen, onClose }: FAQModalProps) {
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);

  const filteredFaqs = faqs.filter(faq => faq.section === activeSection);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
          >
            <div className="bg-gradient-to-br from-[#1a1f1b] to-[#2e3b2b] border border-white/10 rounded-xl sm:rounded-2xl shadow-2xl w-full h-[95vh] sm:h-[85vh] max-w-4xl flex flex-col overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-slate-700/30 to-emerald-900/30 border-b border-white/10 p-3 sm:p-6 flex items-center justify-between flex-shrink-0">
                <div className="min-w-0 flex-1 pr-2">
                  <h2 className="text-base sm:text-2xl font-bold bg-gradient-to-r from-gray-200 to-emerald-200 bg-clip-text text-transparent">
                    Frequently Asked Questions
                  </h2>
                  <p className="text-[10px] sm:text-sm text-gray-400 mt-0.5 sm:mt-1 hidden xs:block">
                    Everything you need to know about messaging your clients
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 sm:p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
                >
                  <X className="w-4 h-4 sm:w-6 sm:h-6 text-gray-400" />
                </button>
              </div>

              {/* Section Tabs */}
              <div className="border-b border-white/10 bg-black/20 flex-shrink-0">
                <div className="flex gap-1.5 sm:gap-2 p-2 sm:p-3">
                  {faqSections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => {
                        setActiveSection(section.id);
                        setExpandedQuestion(null);
                      }}
                      className={`flex-1 px-2 sm:px-4 py-2 sm:py-3 rounded-lg text-[10px] sm:text-sm font-semibold transition-all ${
                        activeSection === section.id
                          ? `bg-gradient-to-r ${section.color} text-white shadow-lg`
                          : 'bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      <div className="text-center">
                        <div className="font-bold leading-tight">{section.title}</div>
                        <div className="text-[9px] sm:text-xs opacity-80 mt-0.5 hidden sm:block">
                          {section.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Content - Fixed Height with Hidden Scrollbar */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden faq-scroll-container">
                <div className="p-3 sm:p-6">
                  <div className="space-y-2 sm:space-y-3">
                    {filteredFaqs.map((faq, index) => (
                      <div
                        key={index}
                        className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg overflow-hidden"
                      >
                        <button
                          onClick={() => setExpandedQuestion(expandedQuestion === index ? null : index)}
                          className="w-full p-2.5 sm:p-4 flex items-start justify-between hover:bg-white/5 transition-colors text-left gap-2"
                        >
                          <span className="font-semibold text-white text-xs sm:text-base leading-snug">
                            {faq.question}
                          </span>
                          {expandedQuestion === index ? (
                            <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                          ) : (
                            <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                          )}
                        </button>

                        <AnimatePresence>
                          {expandedQuestion === index && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-2.5 sm:px-4 pb-2.5 sm:pb-4 text-gray-300 text-[11px] sm:text-sm border-t border-white/10 pt-2.5 sm:pt-4">
                                {faq.answer}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-white/10 p-2.5 sm:p-4 bg-black/20 flex-shrink-0">
                <p className="text-[10px] sm:text-xs text-gray-400 text-center">
                  Still have questions? Reach out to our support team for help!
                </p>
              </div>
            </div>
          </motion.div>

          {/* Hide scrollbar styles */}
          <style jsx>{`
            .faq-scroll-container {
              scrollbar-width: none; /* Firefox */
              -ms-overflow-style: none; /* IE and Edge */
            }
            .faq-scroll-container::-webkit-scrollbar {
              display: none; /* Chrome, Safari, Opera */
            }
          `}</style>
        </>
      )}
    </AnimatePresence>
  );
}