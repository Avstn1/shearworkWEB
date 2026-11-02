'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, ChevronUp, Search } from 'lucide-react';

interface FAQModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSearchQuery?: string;
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
    color: ''
  },
  {
    id: 'sms-features',
    title: 'SMS Features Explained',
    description: 'Auto Nudge, Campaigns, and Mass Messages',
    color: ''
  }
];

const faqs: FAQItem[] = [
  // OVERVIEW SECTION - General
  {
    question: "What are the different messaging types in Corva?",
    answer: (
      <div className="space-y-3">
        <p>Corva offers three ways to message your clients:</p>
        <ul className="space-y-2 ml-4">
          <li className="flex items-start gap-2">
            <span className="text-gray-500 mt-1">•</span>
            <div>
              <strong className="text-ivory">SMS Auto Nudge:</strong> Automatically finds clients who are overdue for a visit and sends them friendly reminders to book again.
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-500 mt-1">•</span>
            <div>
              <strong className="text-ivory">SMS Campaigns:</strong> Perfect for holidays or special promotions. Targets clients who haven't been in recently but are still engaged.
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-500 mt-1">•</span>
            <div>
              <strong className="text-ivory">Mass Messages:</strong> Send announcements to ALL your clients, like when you're closed for vacation or have a special event.
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
        <p>Corva automatically categorizes your clients based on how often they visit. These categories help the messaging system find the right people to contact:</p>
        <div className="rounded-lg border border-white/[0.07] bg-raised p-4 space-y-3">
          <div>
            <h4 className="text-ivory font-semibold mb-1">Consistent</h4>
            <p className="text-sm text-gray-300">
              Visits more than once every 1 week and a few days on average (basically your regulars who come frequently)
            </p>
          </div>
          <div>
            <h4 className="text-ivory font-semibold mb-1">Semi-Consistent</h4>
            <p className="text-sm text-gray-300">
              Visits once every 2-3 weeks on average (reliable clients with a steady schedule)
            </p>
          </div>
          <div>
            <h4 className="text-ivory font-semibold mb-1">Easy-Going</h4>
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
            <h4 className="text-ivory font-semibold mb-1">New</h4>
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

  {
    question: "Why are my Client Sheets total clients way bigger than my SMS clients?",
    answer: (
      <div className="space-y-3">
        <p className="text-gray-200">
          <strong>Client Sheets shows ALL your clients, but SMS features use smart algorithms to filter for the most relevant ones.</strong>
        </p>
        <p>Here's what each SMS feature filters for:</p>
        <div className="rounded-lg border border-white/[0.07] bg-raised p-4 space-y-3">
          <div>
            <h4 className="text-ivory font-semibold mb-2">SMS Auto Nudge</h4>
            <ul className="space-y-1 ml-4 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-gray-500">•</span>
                <span>Only includes clients who are at least 14 days overdue based on their visit pattern</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-500">•</span>
                <span>Heavily prioritizes Consistent and Semi-Consistent clients (90% of selections)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-500">•</span>
                <span>Excludes clients in the 14-day cooldown period</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-500">•</span>
                <span>Skips clients who haven't visited in over 1.5 years</span>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-ivory font-semibold mb-2">SMS Campaigns</h4>
            <ul className="space-y-1 ml-4 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-gray-500">•</span>
                <span>Targets clients who are slightly overdue but not gone forever</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-500">•</span>
                <span>Uses a two-phase system: priority clients first, then fills gaps if needed</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-500">•</span>
                <span>Excludes clients in the 7-day cooldown period</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-500">•</span>
                <span>Focuses on clients who visited within the last 4 months</span>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-ivory font-semibold mb-2">Mass Messages</h4>
            <ul className="space-y-1 ml-4 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-gray-500">•</span>
                <span>Includes ALL clients with valid phone numbers</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-500">•</span>
                <span>Only requires at least one visit in history</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-500">•</span>
                <span>Excludes clients in the 15-day cooldown period</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-500">•</span>
                <span>This is the closest to your total Client Sheets count</span>
              </li>
            </ul>
          </div>
        </div>
        <p className="text-sm bg-white/[0.03] border border-white/[0.07] rounded-lg p-3 mt-3">
          <strong>Bottom line:</strong> The algorithms filter out clients who either don't have phone numbers, are in cooldown, unsubscribed, or don't fit the targeting criteria for that specific message type. This ensures you're messaging the right people at the right time!
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
        <p className="text-gray-200">
          <strong>Corva has built-in cooldowns to prevent annoying your clients with too many messages.</strong>
        </p>
        <div className="rounded-lg border border-white/[0.07] bg-raised p-4 space-y-3">
          <div>
            <h4 className="text-ivory font-semibold mb-2">Auto Nudge Cooldown: 14 days</h4>
            <p className="text-sm">
              After a client receives an Auto Nudge, they won't get another one for at least 14 days, even if they're still overdue.
            </p>
          </div>
          <div>
            <h4 className="text-ivory font-semibold mb-2">Campaign Cooldown: 7 days</h4>
            <p className="text-sm">
              Campaigns wait 7 days after the last message before including a client again.
            </p>
          </div>
          <div>
            <h4 className="text-ivory font-semibold mb-2">Mass Message Cooldown: 15 days (lenient phase)</h4>
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
            <span className="text-sage tabular-nums">1.</span>
            <div>
              <strong>Recent Messages:</strong> Clients messaged recently are in cooldown period
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-sage tabular-nums">2.</span>
            <div>
              <strong>Visit Timing:</strong> Clients might not be overdue enough yet (Auto Nudge needs 14+ days overdue)
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-sage tabular-nums">3.</span>
            <div>
              <strong>Visit Patterns:</strong> Clients might visit too frequently or too rarely to qualify
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-sage tabular-nums">4.</span>
            <div>
              <strong>Phone Numbers:</strong> Some clients might not have valid phone numbers on file
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-sage tabular-nums">5.</span>
            <div>
              <strong>Unsubscribed:</strong> Clients who opted out won't appear
            </div>
          </li>
        </ul>
        <p className="text-sm bg-white/[0.03] border border-white/[0.07] rounded-lg p-3 mt-3">
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
        <p className="text-gray-200">
          <strong>Auto Nudge schedules lock until the 1st of the next month</strong> after you activate them. This prevents accidental spam.
        </p>
        <p>Here's why:</p>
        <ul className="space-y-2 ml-4">
          <li className="flex items-start gap-2">
            <span className="text-gray-500">•</span>
            <span>Auto Nudge runs automatically based on your schedule</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-500">•</span>
            <span>If you could change it anytime, you might accidentally message the same clients twice</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-500">•</span>
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
        <p className="text-gray-200">
          <strong>Campaign and Mass messages are one-time use only.</strong>
        </p>
        <p>Here's what happens:</p>
        <ul className="space-y-2 ml-4">
          <li className="flex items-start gap-2">
            <span className="text-gray-500">•</span>
            <span>Once sent, you can't reuse the same message</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-500">•</span>
            <span>When you delete it, it's "soft deleted" - removed from your active list</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-500">•</span>
            <span>You can still see it in your message history for record-keeping</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-500">•</span>
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
            <span className="text-gray-500">•</span>
            <span>It looks at each client's visit pattern (how often they usually come in)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-500">•</span>
            <span>Calculates how many days "overdue" they are based on their usual schedule</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-500">•</span>
            <span>Only messages clients who are at least <strong>14 days overdue</strong></span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-500">•</span>
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
            <span className="text-sage">✓</span>
            <div>
              <strong className="text-ivory">Consistent clients</strong> - Come in regularly (more than once every 1 week and a few days on average)
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-sage">✓</span>
            <div>
              <strong className="text-ivory">Semi-consistent clients</strong> - Come in fairly regularly (every 2-3 weeks on average)
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-500">~</span>
            <div>
              <strong className="text-gray-300">Easy-going & Rare clients</strong> - May get messages if there aren't enough consistent/semi-consistent clients available
            </div>
          </li>
        </ul>
        <p className="text-sm bg-white/[0.03] border border-white/[0.07] rounded-lg p-3 mt-3">
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
        <div className="rounded-lg border border-white/[0.07] bg-raised p-4 space-y-3">
          <div>
            <h4 className="text-ivory font-semibold mb-2">Phase 1: High-Priority Clients</h4>
            <ul className="space-y-1 ml-4 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-gray-500">•</span>
                <span>Clients who are a bit overdue but not gone forever</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-500">•</span>
                <span>Consistent clients: 0-45 days overdue</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-500">•</span>
                <span>Semi-consistent: 0-30 days overdue</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-500">•</span>
                <span>New clients: 21-60 days since their first visit</span>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-ivory font-semibold mb-2">Phase 2: Fill the Gaps</h4>
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
        <p>Mass Messages are the simplest - they go to <strong className="text-ivory">EVERYONE!</strong></p>
        <p>Here's who gets included:</p>
        <ul className="space-y-2 ml-4">
          <li className="flex items-start gap-2">
            <span className="text-gray-500">•</span>
            <span>All clients with a phone number</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-500">•</span>
            <span>Who have visited at least once</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-500">•</span>
            <span>Haven't unsubscribed from messages</span>
          </li>
        </ul>
        <p className="text-sm bg-amber-300/[0.06] border border-amber-300/20 rounded-lg p-3 mt-3">
          <strong className="text-amber-300">Important:</strong> Mass messages don't filter by visit recency. Use these sparingly for important announcements only!
        </p>
      </div>
    ),
    section: 'sms-features'
  },
  {
    question: "When should I use Mass Messages vs Campaigns?",
    answer: (
      <div className="space-y-3">
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-lg p-4">
          <h4 className="text-ivory font-semibold mb-2">Use Mass Messages for:</h4>
          <ul className="space-y-1 ml-4 text-sm">
            <li>• Shop closures or schedule changes</li>
            <li>• Important announcements everyone needs to know</li>
            <li>• Special events at your shop</li>
            <li>• Holiday greetings to all clients</li>
          </ul>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-lg p-4">
          <h4 className="text-ivory font-semibold mb-2">Use Campaigns for:</h4>
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


export default function FAQModal({ isOpen, onClose, initialSearchQuery }: FAQModalProps) {
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // Set search query and expand first result when modal opens
  useEffect(() => {
    if (isOpen && initialSearchQuery) {
      setSearchKeyword(initialSearchQuery);
      setExpandedQuestion(0); // Expand the first search result
    }
  }, [isOpen, initialSearchQuery]);

  // Extract text from React elements for searching
  const extractText = (content: string | React.ReactElement): string => {
    if (typeof content === 'string') return content;
    
    const getText = (element: any): string => {
      if (!element) return '';
      if (typeof element === 'string') return element;
      if (typeof element === 'number') return String(element);
      if (Array.isArray(element)) return element.map(getText).join(' ');
      if (element.props?.children) return getText(element.props.children);
      return '';
    };
    
    return getText(content);
  };

  // Filter by search keyword globally across ALL FAQs
  const searchFilteredFaqs = searchKeyword.trim()
    ? faqs.filter((faq) => {
        const keyword = searchKeyword.toLowerCase();
        const questionMatch = faq.question.toLowerCase().includes(keyword);
        const answerText = extractText(faq.answer).toLowerCase();
        const answerMatch = answerText.includes(keyword);
        return questionMatch || answerMatch;
      })
    : null;

  // Show search results if searching, otherwise filter by section
  const displayedFaqs = searchFilteredFaqs || faqs.filter((f) => f.section === activeSection);

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="modal-backdrop"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-none fixed inset-0 z-[61] flex items-center justify-center p-2 sm:p-4"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="faq-modal-title"
              className="modal-surface pointer-events-auto flex h-[80vh] w-full max-w-3xl flex-col overflow-hidden sm:h-[85vh]"
            >
              {/* Header */}
              <div className="flex flex-shrink-0 items-start justify-between gap-3 border-b border-white/[0.07] px-4 py-4 sm:px-6">
                <div className="min-w-0 flex-1">
                  <h2 id="faq-modal-title" className="text-[17px] font-semibold tracking-[-0.01em] text-ivory">
                    Frequently asked questions
                  </h2>
                  <p className="mt-0.5 hidden text-[13px] text-muted sm:block">
                    Everything you need to know about messaging your clients
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="btn btn-ghost btn-sm !px-2"
                >
                  <X size={18} strokeWidth={1.75} />
                </button>
              </div>

              {/* Search + section switcher */}
              <div className="flex flex-shrink-0 flex-col gap-3 border-b border-white/[0.07] px-4 py-3 sm:px-6">
                <div className="relative">
                  <Search size={16} strokeWidth={1.75} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={searchKeyword}
                    onChange={(e) => {
                      setSearchKeyword(e.target.value);
                      setExpandedQuestion(null);
                    }}
                    placeholder="Search all questions and answers..."
                    className="field !pl-9 !pr-9"
                  />
                  {searchKeyword && (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => {
                        setSearchKeyword('');
                        setExpandedQuestion(null);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-500 transition-colors hover:bg-white/[0.06] hover:text-ivory"
                    >
                      <X size={14} strokeWidth={1.75} />
                    </button>
                  )}
                </div>
                {searchKeyword ? (
                  <p className="text-xs text-muted">
                    Searching across all sections · Found {displayedFaqs.length} result{displayedFaqs.length !== 1 ? 's' : ''}
                  </p>
                ) : (
                  <div className="segmented w-full" role="tablist">
                    {faqSections.map((section) => (
                      <button
                        key={section.id}
                        type="button"
                        role="tab"
                        aria-selected={activeSection === section.id}
                        data-active={activeSection === section.id}
                        title={section.description}
                        onClick={() => {
                          setActiveSection(section.id);
                          setExpandedQuestion(null);
                        }}
                        className="segmented-item"
                      >
                        {section.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden">
                <div className="p-4 sm:p-6">
                  {displayedFaqs.length === 0 ? (
                    <div className="empty-state">
                      <Search aria-hidden="true" />
                      <strong>No matching questions</strong>
                      <p className="max-w-sm">No questions found matching &ldquo;{searchKeyword}&rdquo;</p>
                      <button
                        type="button"
                        onClick={() => setSearchKeyword('')}
                        className="btn btn-glass btn-sm mt-2"
                      >
                        Clear search
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-white/[0.07]">
                      {displayedFaqs.map((faq, index) => (
                        <div
                          key={index}
                          className="border-b border-white/[0.07] last:border-b-0"
                        >
                          <button
                            type="button"
                            aria-expanded={expandedQuestion === index}
                            onClick={() => setExpandedQuestion(expandedQuestion === index ? null : index)}
                            className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.02]"
                          >
                            <span className="text-[14px] font-medium leading-snug text-ivory">
                              {faq.question}
                            </span>
                            {expandedQuestion === index ? (
                              <ChevronUp size={16} strokeWidth={1.75} className="mt-0.5 flex-shrink-0 text-gray-500" />
                            ) : (
                              <ChevronDown size={16} strokeWidth={1.75} className="mt-0.5 flex-shrink-0 text-gray-500" />
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
                                <div className="px-4 pb-4 pt-1 text-[13px] leading-relaxed text-gray-300 sm:text-sm">
                                  {faq.answer}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex-shrink-0 border-t border-white/[0.07] px-4 py-3 sm:px-6">
                <p className="text-center text-xs text-muted">
                  Still have questions? Reach out to our support team for help!
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  // Render to document body using portal
  return typeof window !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
