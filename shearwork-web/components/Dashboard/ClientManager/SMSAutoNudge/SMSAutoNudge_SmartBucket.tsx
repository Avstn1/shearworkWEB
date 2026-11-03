'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, TrendingUp, Calendar, Users, ArrowLeft, Info, Loader2, ChevronRight, Clock } from 'lucide-react';
import { supabase } from '@/utils/supabaseClient';
import HowAutoNudgeWorksModal from './Modals/HowAutoNudgeWorksModal';
import { EmptyState } from '@/components/ui/AppKit';
import ClientMessageHistory from '@/components/AutoNudgeDashboard/ClientMessageHistory';

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
  status: 'booked' | 'messaged' | 'pending' | 'failed';
  has_replied: boolean;
  has_unread: boolean;
  failure_reason?: string;
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

const DAY_OFFSET: Record<string, number> = {
  Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3,
  Friday: 4, Saturday: 5, Sunday: 6,
};

const TIME_SEND: Record<string, { hour: number; minute: number }> = {
  Morning:   { hour: 18, minute: 0  },
  Midday:    { hour: 18, minute: 30 },
  Afternoon: { hour: 16, minute: 0  },
  Night:     { hour: 20, minute: 0  },
};

const getScheduledSendDate = (
  bucket: string | null,
  campaignStart: string
): Date => {
  const monday = new Date(campaignStart);
  monday.setHours(0, 0, 0, 0);

  let dayOffset = 0;
  let hour = 18;
  let minute = 30;

  if (bucket && bucket !== 'Low-data') {
    const [dayPart, timePart] = bucket.split('|');
    dayOffset = dayPart !== 'Any-day' ? (DAY_OFFSET[dayPart] ?? 0) : 0;
    const sendTime = timePart !== 'Any-time' ? TIME_SEND[timePart] : null;
    hour   = sendTime?.hour   ?? 18;
    minute = sendTime?.minute ?? 30;
  }

  const send = new Date(monday);
  send.setDate(monday.getDate() + dayOffset);
  send.setHours(hour, minute, 0, 0);
  return send;
};

// ----------------------------------------------------------------
// Badge config
// ----------------------------------------------------------------

const STATUS_BADGE: Record<SMSRecipient['status'], { label: string; classes: string }> = {
  booked:   { label: 'Booked',    classes: 'badge-sage' },
  messaged: { label: 'Messaged',  classes: 'badge-info' },
  pending:  { label: 'Pending',   classes: 'badge-warn' },
  failed:   { label: 'Failed',    classes: 'badge-danger' },
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
  const [activeThread, setActiveThread] = useState<{ phone: string; name: string; user_id: string } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const openThread = async (phone: string, name: string) => {
    if (!currentUserId) return

    // Mark all unread replies from this client as read
    await supabase
      .from('sms_replies')
      .update({ ui_read: true })
      .eq('user_id', currentUserId)
      .eq('phone_number', phone)
      .eq('ui_read', false)

    // Optimistically clear unread state in local recipients
    setRecipients(prev =>
      prev.map(r => r.phone === phone ? { ...r, has_unread: false } : r)
    )

    setActiveThread({ phone, name, user_id: currentUserId })
  }

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

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

      const { data: smsSentRows } = await supabase
        .from('sms_sent')
        .select('phone_normalized, is_sent, reason, created_at')
        .eq('smart_bucket_id', campaign.bucket_id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      const smsSentMap = new Map<string, { is_sent: boolean; reason: string | null; created_at: string }>();
      for (const row of smsSentRows || []) {
        if (row.phone_normalized && !smsSentMap.has(row.phone_normalized)) {
          smsSentMap.set(row.phone_normalized, {
            is_sent: row.is_sent,
            reason: row.reason ?? null,
            created_at: row.created_at,
          });
        }
      }

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

      // Compute Monday–Sunday bounds for the selected ISO week
      const weekMonday = new Date(bucket.campaign_start);
      weekMonday.setHours(0, 0, 0, 0);
      const weekSunday = new Date(weekMonday);
      weekSunday.setDate(weekMonday.getDate() + 6);
      weekSunday.setHours(23, 59, 59, 999);

      const { data: replyRows } = await supabase
        .from('sms_replies')
        .select('phone_number')
        .eq('user_id', user.id)
        .not('client_id', 'is', null)
        .gte('received_at', weekMonday.toISOString())
        .lte('received_at', weekSunday.toISOString());

      const repliedPhones = new Set((replyRows || []).map(r => r.phone_number));

      // Phones that have at least one unread reply this week
      const { data: unreadRows } = await supabase
        .from('sms_replies')
        .select('phone_number')
        .eq('user_id', user.id)
        .not('client_id', 'is', null)
        .eq('ui_read', false)
        .gte('received_at', weekMonday.toISOString())
        .lte('received_at', weekSunday.toISOString());

      const unreadPhones = new Set((unreadRows || []).map(r => r.phone_number));

      const recipientsList: SMSRecipient[] = bucket.clients.map((client: SmartBucket['clients'][number]) => {
        const bookedIndex = client.client_id ? bookedClientIds.indexOf(client.client_id) : -1;
        const isBooked = bookedIndex !== -1;
        const sentRow = client.phone ? smsSentMap.get(client.phone) : undefined;
        const isMessaged = sentRow?.is_sent === true;
        const isFailed = sentRow?.is_sent === false;

        let status: SMSRecipient['status'] = 'pending';
        if (isBooked) status = 'booked';
        else if (isMessaged) status = 'messaged';
        else if (isFailed) status = 'failed';

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
          has_replied: client.phone ? repliedPhones.has(client.phone) : false,
          has_unread: client.phone ? unreadPhones.has(client.phone) : false,
          failure_reason: isFailed ? (sentRow?.reason || 'Unknown error') : undefined,
          messaged_at: isMessaged ? sentRow!.created_at : null,
          scheduled_send: scheduledSend,
          service: isBooked ? services[bookedIndex] : undefined,
          price: isBooked ? prices[bookedIndex] : undefined,
          appointment_date: isBooked ? appointmentDates[bookedIndex] : undefined,
        };
      });

      const ORDER = { booked: 0, messaged: 1, pending: 2, failed: 3 };
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
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="panel">
          <div className="panel-header !items-start">
            <div className="flex items-start gap-2.5 min-w-0">
              <MessageSquare className="w-[18px] h-[18px] text-sage flex-shrink-0 mt-0.5" strokeWidth={1.75} />
              <div className="min-w-0">
                <h2 className="panel-title">SMS Auto Nudge</h2>
                <p className="panel-subtitle">
                  Your weekly automated SMS campaigns, controlled entirely by you via text.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowHowItWorks(true)}
              className="btn btn-glass btn-sm !h-8 !px-2.5 !gap-1.5 text-xs flex-shrink-0"
            >
              <Info className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span className="hidden sm:inline">How it works</span>
              <span className="sm:hidden">Info</span>
            </button>
          </div>

          {/* Summary Stats */}
          {!isLoading && campaigns.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 px-4 sm:px-5 py-4">
              <div>
                <p className="stat-label mb-1">Total campaigns</p>
                <p className="text-xl font-semibold text-ivory tabular-nums">{campaigns.length}</p>
              </div>
              <div>
                <p className="stat-label mb-1">Total booked</p>
                <p className="text-xl font-semibold text-sage-bright tabular-nums">{totalBooked}</p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className="stat-label mb-1">Avg booked / week</p>
                <p className="text-xl font-semibold text-ivory tabular-nums">
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
              <div className="panel overflow-hidden">
                <div className="panel-header !justify-start">
                  <TrendingUp className="w-4 h-4 text-sage" strokeWidth={1.75} />
                  <h3 className="panel-title">Campaign history</h3>
                </div>

                {isLoading ? (
                  <div className="empty-state py-16">
                    <Loader2 className="animate-spin" strokeWidth={1.75} />
                    <p>Loading campaigns...</p>
                  </div>
                ) : campaigns.length === 0 ? (
                  <EmptyState icon={TrendingUp} title="No campaigns yet">
                    Once your first weekly nudge goes out and clients start booking, campaigns will show up here.
                  </EmptyState>
                ) : (
                  <div className="divide-y divide-white/[0.05]">
                    {campaigns.map((campaign) => (
                      <button
                        key={campaign.bucket_id}
                        onClick={() => handleCampaignClick(campaign)}
                        className="w-full flex items-center gap-4 px-4 sm:px-5 py-3.5 hover:bg-white/[0.02] transition-colors text-left group"
                      >
                        <div className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-raised border border-white/[0.07] flex flex-col items-center justify-center">
                          <span className="text-[9px] text-gray-500 font-semibold uppercase tracking-wide">Wk</span>
                          <span className="text-sm font-semibold text-ivory leading-none tabular-nums">
                            {campaign.iso_week.split('-W')[1]}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-ivory truncate tabular-nums">
                            {campaign.week_start} – {campaign.week_end}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Calendar className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" strokeWidth={1.75} />
                            <p className="text-xs text-muted truncate tabular-nums">Started {formatDate(campaign.campaign_start)}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-base font-semibold text-sage-bright tabular-nums">{campaign.clients_booked}</p>
                            <p className="text-[11px] text-gray-500">booked</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-ivory transition-colors" strokeWidth={1.75} />
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
              <div className="panel overflow-hidden">
                {/* Detail Header */}
                <div className="panel-header !justify-start">
                  <button
                    onClick={handleBack}
                    className="btn btn-ghost btn-sm !h-8 !px-2 flex-shrink-0"
                    aria-label="Back"
                  >
                    <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="panel-title truncate tabular-nums">
                      {selectedCampaign?.week_start} – {selectedCampaign?.week_end}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5 text-xs tabular-nums">
                      <p className="text-muted">
                        Started {selectedCampaign && formatDate(selectedCampaign.campaign_start)}
                      </p>
                      {selectedCampaign && (
                        <>
                          <span className="text-gray-600">·</span>
                          <span className="text-sage-bright font-medium">
                            {selectedCampaign.clients_booked} booked
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {selectedCampaign && (
                    <span className="badge flex-shrink-0 !py-1 tabular-nums">
                      <Users className="w-3 h-3" strokeWidth={1.75} />
                      {recipients.length} recipients
                    </span>
                  )}
                </div>

                {/* Optimal timing notice */}
                {recipients.length > 0 && !loadingRecipients && (
                  <div className="mx-4 sm:mx-5 mt-4 flex items-start gap-2.5 p-3 bg-white/[0.03] border border-white/[0.07] rounded-lg">
                    <Clock className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                    <p className="text-[13px] text-muted leading-relaxed">
                      Each client is messaged at their <span className="text-ivory font-medium">personal optimal time</span> — based on when they historically tend to book. Clients with no clear pattern are reached on <span className="text-ivory font-medium">Mondays at 10am</span>.
                    </p>
                  </div>
                )}

                {/* Recipients */}
                {loadingRecipients ? (
                  <div className="empty-state py-16">
                    <Loader2 className="animate-spin" strokeWidth={1.75} />
                    <p>Loading recipients...</p>
                  </div>
                ) : recipients.length === 0 ? (
                  <EmptyState icon={Users} title="No recipients found" />
                ) : (
                  <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {recipients.map((recipient, index) => {
                      const badge = STATUS_BADGE[recipient.status];
                      const isBooked = recipient.status === 'booked';
                      const isMessaged = recipient.status === 'messaged';
                      const isFailed = recipient.status === 'failed';

                      return (
                        <div
                          key={`${recipient.client_id || recipient.phone}-${index}`}
                          className={`rounded-lg border p-3.5 flex flex-col gap-3 ${
                            isBooked
                              ? 'bg-sage/[0.04] border-sage/20'
                              : isMessaged
                              ? 'bg-white/[0.02] border-white/[0.07]'
                              : isFailed
                              ? 'bg-[#FF8F7D]/[0.04] border-[#FF8F7D]/15'
                              : 'bg-white/[0.02] border-white/[0.07]'
                          }`}
                        >
                          {/* Name + badges */}
                          <div className="flex items-start justify-between flex-wrap gap-1.5">
                            <p className="text-sm font-semibold text-ivory">
                              {recipient.full_name
                                ? capitalizeName(recipient.full_name)
                                : <span className="text-gray-500 font-normal">Unknown Client</span>
                              }
                            </p>
                            <div className="flex items-center flex-wrap gap-1 flex-shrink-0">
                              <span className={`badge flex-shrink-0 ${badge.classes}`}>
                                {badge.label}
                              </span>
                              {recipient.has_replied && (
                                <span className="badge badge-sage flex-shrink-0">
                                  Replied
                                </span>
                              )}
                              {recipient.phone && (
                                <button
                                  onClick={() => openThread(
                                    recipient.phone!,
                                    recipient.full_name ? capitalizeName(recipient.full_name) : recipient.phone!,
                                  )}
                                  className="btn btn-glass btn-sm relative !h-6 !px-2 !gap-1 !text-[11px] !font-medium"
                                >
                                  {recipient.has_unread && (
                                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#FF8F7D]" />
                                  )}
                                  <MessageSquare className="w-3 h-3" strokeWidth={1.75} />
                                  <span className="hidden sm:inline">Click to view message history</span>
                                  <span className="sm:hidden">Message History</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Phone + send time / failure reason line */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-gray-500 flex-shrink-0 tabular-nums">
                              {formatPhoneNumber(recipient.phone)}
                            </span>
                            {isFailed && recipient.failure_reason ? (
                              <span className="text-[11px] text-[#FF8F7D] truncate text-right">{recipient.failure_reason}</span>
                            ) : (
                              <div className="flex items-center gap-1 text-muted">
                                <Clock className="w-3 h-3 flex-shrink-0" strokeWidth={1.75} />
                                <span className="text-[11px] tabular-nums">
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
                            )}
                          </div>

                          {/* Booking details — only if booked */}
                          {isBooked && recipient.service && (
                            <div className="pt-3 mt-auto border-t border-white/[0.07] flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-[13px] font-medium text-ivory truncate">{recipient.service}</p>
                                {recipient.appointment_date && (
                                  <p className="text-[11px] text-muted mt-0.5 tabular-nums">
                                    {new Date(recipient.appointment_date).toLocaleDateString('en-US', {
                                      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
                                    })}
                                  </p>
                                )}
                              </div>
                              {recipient.price && (
                                <p className="text-sm font-semibold text-sage-bright flex-shrink-0 tabular-nums">${recipient.price}</p>
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

      {/* Message thread modal */}
      {activeThread && (
        <ClientMessageHistory
          user_id={activeThread.user_id}
          client_phone={activeThread.phone}
          client_name={activeThread.name}
          onClose={() => setActiveThread(null)}
        />
      )}
    </>
  );
}