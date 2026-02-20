'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, TrendingUp, Calendar, Users, ArrowLeft, Info, Loader2, ChevronRight, Clock } from 'lucide-react';
import { supabase } from '@/utils/supabaseClient';
import HowAutoNudgeWorksModal from './Modals/HowAutoNudgeWorksModal';

interface SmartBucket {
  bucket_id: string;
  iso_week: string;
  status: string;
  campaign_start: string;
  campaign_end: string;
  clients: {
    client_id: string;
    phone: string;
    appointment_datecreated_bucket: string | null;
    full_name: string;
  }[];
  total_clients: number;
  messages_failed: string[];
}

interface BarberNudgeCampaign {
  bucket_id: string;
  iso_week: string;
  week_start: string;
  week_end: string;
  clients_booked: number;
  campaign_start: string;
  total_clients: number;
}

interface SMSRecipient {
  client_id: string | null;
  full_name: string | null;
  phone: string | null;
  appointment_datecreated_bucket: string | null;
  status: 'booked' | 'messaged' | 'pending';
  messaged_at: string | null;
  scheduled_send: Date | null;
  service?: string;
  price?: string;
  appointment_date?: string;
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

const getISOWeekDates = (isoWeek: string): { start: string; end: string } => {
  const [yearStr, weekStr] = isoWeek.split('-W');
  const year = parseInt(yearStr);
  const week = parseInt(weekStr);
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const firstMonday = new Date(jan4);
  firstMonday.setDate(jan4.getDate() - jan4Day + 1);
  const monday = new Date(firstMonday);
  monday.setDate(firstMonday.getDate() + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return { start: formatDate(monday), end: formatDate(sunday) };
};

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
  });

const formatAbsolute = (date: Date) =>
  date.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  });

const formatPhoneNumber = (phone: string | null) => {
  if (!phone) return 'No phone';
  const digits = phone.replace(/\D/g, '');
  const phoneDigits = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (phoneDigits.length === 10)
    return `(${phoneDigits.slice(0, 3)}) ${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6, 10)}`;
  return phone;
};

const capitalizeName = (name: string) =>
  name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

// Day offset from Monday (0=Mon, 1=Tue, … 6=Sun)
const DAY_OFFSET: Record<string, number> = {
  Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3,
  Friday: 4, Saturday: 5, Sunday: 6,
};

// Hour of day for each time bucket
const TIME_HOUR: Record<string, number> = {
  Morning: 8, Midday: 12, Afternoon: 16, Night: 20,
};

/**
 * Computes the absolute Date the message will be sent for this client,
 * anchored to the Monday of the campaign week.
 */
const getScheduledSendDate = (
  bucket: string | null,
  campaignStart: string // ISO timestamp of Monday
): Date => {
  const monday = new Date(campaignStart);
  // Normalise to midnight of that Monday
  monday.setHours(0, 0, 0, 0);

  let dayOffset = 0;  // default: Monday
  let hour = 10;      // default: 10am

  if (bucket && bucket !== 'Low-data') {
    const [dayPart, timePart] = bucket.split('|');
    dayOffset = dayPart !== 'Any-day' ? (DAY_OFFSET[dayPart] ?? 0) : 0;
    hour = timePart !== 'Any-time' ? (TIME_HOUR[timePart] ?? 10) : 10;
  }

  const send = new Date(monday);
  send.setDate(monday.getDate() + dayOffset);
  send.setHours(hour, 0, 0, 0);
  return send;
};

// ----------------------------------------------------------------
// Badge config
// ----------------------------------------------------------------

const STATUS_BADGE: Record<SMSRecipient['status'], { label: string; classes: string }> = {
  booked:   { label: '✓ Booked',   classes: 'bg-lime-300/10 text-lime-300 border-lime-300/20' },
  messaged: { label: 'Messaged',   classes: 'bg-sky-300/10 text-sky-300 border-sky-300/20' },
  pending:  { label: 'Pending',    classes: 'bg-amber-300/10 text-amber-300 border-amber-300/20' },
};

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------

export default function SMSAutoNudge() {
  const [view, setView] = useState<'list' | 'details'>('list');
  const [campaigns, setCampaigns] = useState<BarberNudgeCampaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<BarberNudgeCampaign | null>(null);
  const [recipients, setRecipients] = useState<SMSRecipient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: buckets, error } = await supabase
        .from('sms_smart_buckets')
        .select('bucket_id, iso_week, status, campaign_start, campaign_end, clients, total_clients, messages_failed')
        .eq('user_id', user.id)
        .order('campaign_start', { ascending: false });

      if (error || !buckets?.length) {
        setCampaigns([]);
        return;
      }

      const campaignList: BarberNudgeCampaign[] = [];

      for (const bucket of buckets) {
        const { data: successData } = await supabase
          .from('barber_nudge_success')
          .select('client_ids')
          .eq('user_id', user.id)
          .eq('iso_week_number', bucket.iso_week)
          .single();

        const { start, end } = getISOWeekDates(bucket.iso_week);
        campaignList.push({
          bucket_id: bucket.bucket_id,
          iso_week: bucket.iso_week,
          week_start: start,
          week_end: end,
          clients_booked: successData?.client_ids?.length || 0,
          campaign_start: bucket.campaign_start,
          total_clients: bucket.total_clients,
        });
      }

      setCampaigns(campaignList);
    } catch (error) {
      console.error('Failed to fetch campaigns:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRecipients = async (campaign: BarberNudgeCampaign) => {
    setLoadingRecipients(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch the bucket's client list
      const { data: bucket, error: bucketError } = await supabase
        .from('sms_smart_buckets')
        .select('clients, campaign_start')
        .eq('bucket_id', campaign.bucket_id)
        .single();

      if (bucketError || !bucket?.clients?.length) {
        setRecipients([]);
        setView('details');
        return;
      }

      // Fetch all sms_sent rows for this bucket to determine messaged status
      const { data: smsSentRows } = await supabase
        .from('sms_sent')
        .select('phone_normalized, is_sent, created_at')
        .eq('smart_bucket_id', campaign.bucket_id);

      // Map phone_normalized -> sent row for O(1) lookup
      const smsSentMap = new Map<string, { is_sent: boolean; created_at: string }>();
      for (const row of smsSentRows || []) {
        if (row.phone_normalized) {
          smsSentMap.set(row.phone_normalized, {
            is_sent: row.is_sent,
            created_at: row.created_at,
          });
        }
      }

      // Fetch booked data
      const { data: successData } = await supabase
        .from('barber_nudge_success')
        .select('client_ids, services, prices, appointment_dates')
        .eq('user_id', user.id)
        .eq('iso_week_number', campaign.iso_week)
        .single();

      const bookedClientIds: string[] = successData?.client_ids || [];
      const services: string[] = successData?.services || [];
      const prices: string[] = successData?.prices || [];
      const appointmentDates: string[] = successData?.appointment_dates || [];

      const recipientsList: SMSRecipient[] = bucket.clients.map((client: SmartBucket['clients'][number]) => {
        const bookedIndex = client.client_id ? bookedClientIds.indexOf(client.client_id) : -1;
        const isBooked = bookedIndex !== -1;
        const sentRow = client.phone ? smsSentMap.get(client.phone) : undefined;
        const isMessaged = sentRow?.is_sent === true;

        let status: SMSRecipient['status'] = 'pending';
        if (isBooked) status = 'booked';
        else if (isMessaged) status = 'messaged';

        const scheduledSend = getScheduledSendDate(
          client.appointment_datecreated_bucket,
          bucket.campaign_start
        );

        return {
          client_id: client.client_id,
          full_name: client.full_name || null,
          phone: client.phone || null,
          appointment_datecreated_bucket: client.appointment_datecreated_bucket ?? null,
          status,
          messaged_at: isMessaged ? sentRow!.created_at : null,
          scheduled_send: scheduledSend,
          service: isBooked ? services[bookedIndex] : undefined,
          price: isBooked ? prices[bookedIndex] : undefined,
          appointment_date: isBooked ? appointmentDates[bookedIndex] : undefined,
        };
      });

      // Sort: booked first, then messaged, then pending
      const ORDER = { booked: 0, messaged: 1, pending: 2 };
      const sorted = recipientsList.sort((a, b) => {
        if (a.status !== b.status) return ORDER[a.status] - ORDER[b.status];
        if (a.status === 'booked' && b.status === 'booked') {
          return new Date(a.appointment_date!).getTime() - new Date(b.appointment_date!).getTime();
        }
        return 0;
      });

      setRecipients(sorted);
      setView('details');
    } catch (error) {
      console.error('Failed to fetch recipients:', error);
    } finally {
      setLoadingRecipients(false);
    }
  };

  const handleCampaignClick = (campaign: BarberNudgeCampaign) => {
    setSelectedCampaign(campaign);
    fetchRecipients(campaign);
  };

  const handleBack = () => {
    setView('list');
    setSelectedCampaign(null);
    setRecipients([]);
  };

  const totalBooked = campaigns.reduce((sum, c) => sum + c.clients_booked, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2 mb-1">
              <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-sky-300 flex-shrink-0" />
              SMS Auto Nudge
            </h2>
            <p className="text-xs sm:text-sm text-white/40">
              Your weekly automated SMS campaigns, controlled entirely by you via text.
            </p>
          </div>
          <button
            onClick={() => setShowHowItWorks(true)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-sky-300/10 border border-sky-300/20 text-sky-300 rounded-lg text-xs sm:text-sm font-semibold hover:bg-sky-300/20 transition-all"
          >
            <Info className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">How it works</span>
            <span className="sm:hidden">Info</span>
          </button>
        </div>

        {/* Summary Stats */}
        {!isLoading && campaigns.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/8">
            <div className="p-3 bg-white/5 rounded-xl">
              <p className="text-xs text-white/40 mb-1">Total Campaigns</p>
              <p className="text-xl font-bold text-white">{campaigns.length}</p>
            </div>
            <div className="p-3 bg-lime-400/5 border border-lime-400/10 rounded-xl">
              <p className="text-xs text-white/40 mb-1">Total Booked</p>
              <p className="text-xl font-bold text-lime-300">{totalBooked}</p>
            </div>
            <div className="p-3 bg-white/5 rounded-xl col-span-2 sm:col-span-1">
              <p className="text-xs text-white/40 mb-1">Avg Booked / Week</p>
              <p className="text-xl font-bold text-white">
                {campaigns.length ? (totalBooked / campaigns.length).toFixed(1) : '0'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {view === 'list' ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.18 }}
          >
            <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 sm:px-6 py-4 border-b border-white/8">
                <TrendingUp className="w-4 h-4 text-lime-300" />
                <h3 className="font-bold text-white text-sm sm:text-base">Campaign History</h3>
              </div>

              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="w-7 h-7 text-sky-300 animate-spin" />
                  <p className="text-sm text-white/40">Loading campaigns...</p>
                </div>
              ) : campaigns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-1">
                    <TrendingUp className="w-6 h-6 text-white/20" />
                  </div>
                  <p className="text-white/60 font-medium">No campaigns yet</p>
                  <p className="text-xs text-white/30 max-w-xs">
                    Once your first weekly nudge goes out and clients start booking, campaigns will show up here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {campaigns.map((campaign) => (
                    <button
                      key={campaign.bucket_id}
                      onClick={() => handleCampaignClick(campaign)}
                      className="w-full flex items-center gap-4 px-4 sm:px-6 py-4 hover:bg-white/5 transition-colors text-left group"
                    >
                      <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/5 border border-white/8 flex flex-col items-center justify-center">
                        <span className="text-[9px] text-white/30 font-semibold uppercase tracking-wide">Wk</span>
                        <span className="text-sm sm:text-base font-bold text-white leading-none">
                          {campaign.iso_week.split('-W')[1]}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm sm:text-base font-semibold text-white truncate">
                          {campaign.week_start} – {campaign.week_end}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Calendar className="w-3 h-3 text-white/30 flex-shrink-0" />
                          <p className="text-xs text-white/40 truncate">Started {formatDate(campaign.campaign_start)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-base sm:text-lg font-bold text-lime-300">{campaign.clients_booked}</p>
                          <p className="text-[10px] text-white/30">booked</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="details"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.18 }}
          >
            <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl overflow-hidden">
              {/* Detail Header */}
              <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-white/8">
                <button
                  onClick={handleBack}
                  className="p-1.5 hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
                >
                  <ArrowLeft className="w-4 h-4 text-white/50" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm sm:text-base font-bold text-white truncate">
                    {selectedCampaign?.week_start} – {selectedCampaign?.week_end}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <p className="text-xs text-white/40">
                      Started {selectedCampaign && formatDate(selectedCampaign.campaign_start)}
                    </p>
                    {selectedCampaign && (
                      <>
                        <span className="text-white/20 text-xs">·</span>
                        <span className="text-xs text-lime-300 font-semibold">
                          {selectedCampaign.clients_booked} booked
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {selectedCampaign && (
                  <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-lime-300/10 border border-lime-300/20 rounded-full">
                    <Users className="w-3.5 h-3.5 text-lime-300" />
                    <span className="text-xs font-bold text-lime-300">{recipients.length} recipients</span>
                  </div>
                )}
              </div>

              {/* Optimal timing notice */}
              {recipients.length > 0 && !loadingRecipients && (
                <div className="mx-4 sm:mx-6 mt-4 flex items-start gap-2.5 px-4 py-3 bg-sky-300/5 border border-sky-300/15 rounded-xl">
                  <Clock className="w-4 h-4 text-sky-300 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-white/50 leading-relaxed">
                    Each client is messaged at their <span className="text-sky-300 font-semibold">personal optimal time</span> — based on when they historically tend to book. Clients with no clear pattern are reached on <span className="text-white/70 font-medium">Mondays at 10am</span>.
                  </p>
                </div>
              )}

              {/* Recipients */}
              {loadingRecipients ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="w-7 h-7 text-sky-300 animate-spin" />
                  <p className="text-sm text-white/40">Loading recipients...</p>
                </div>
              ) : recipients.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-center px-6">
                  <Users className="w-8 h-8 text-white/15 mb-1" />
                  <p className="text-white/50 font-medium text-sm">No recipients found</p>
                </div>
              ) : (
                <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {recipients.map((recipient, index) => {
                    const badge = STATUS_BADGE[recipient.status];
                    const isBooked = recipient.status === 'booked';
                    const isMessaged = recipient.status === 'messaged';

                    return (
                      <div
                        key={`${recipient.client_id || recipient.phone}-${index}`}
                        className={`rounded-xl border p-4 flex flex-col gap-3 ${
                          isBooked
                            ? 'bg-lime-300/5 border-lime-300/15'
                            : isMessaged
                            ? 'bg-sky-300/5 border-sky-300/15'
                            : 'bg-white/[0.03] border-white/8'
                        }`}
                      >
                        {/* Name + badge */}
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-bold text-white truncate">
                            {recipient.full_name
                              ? capitalizeName(recipient.full_name)
                              : <span className="text-white/30 font-normal">Unknown Client</span>
                            }
                          </p>
                          <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.classes}`}>
                            {badge.label}
                          </span>
                        </div>

                        {/* Phone + send time line */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-white/25">
                            {formatPhoneNumber(recipient.phone)}
                          </span>
                          <div className="flex items-center gap-1 text-white/35">
                            <Clock className="w-3 h-3 flex-shrink-0" />
                            <span className="text-[11px]">
                              {isMessaged && recipient.messaged_at
                                ? `Messaged on ${formatAbsolute(new Date(recipient.messaged_at))}`
                                : isBooked
                                ? null
                                : recipient.scheduled_send
                                ? `Will be messaged on ${formatAbsolute(recipient.scheduled_send)}`
                                : null
                              }
                            </span>
                          </div>
                        </div>

                        {/* Booking details — only if booked */}
                        {isBooked && recipient.service && (
                          <div className="pt-3 mt-auto border-t border-white/8 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-lime-300 truncate">{recipient.service}</p>
                              {recipient.appointment_date && (
                                <p className="text-[11px] text-white/30 mt-0.5">
                                  {new Date(recipient.appointment_date).toLocaleDateString('en-US', {
                                    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
                                  })}
                                </p>
                              )}
                            </div>
                            {recipient.price && (
                              <p className="text-sm font-bold text-lime-300 flex-shrink-0">${recipient.price}</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <HowAutoNudgeWorksModal
        isOpen={showHowItWorks}
        onClose={() => setShowHowItWorks(false)}
      />
    </div>
  );
}