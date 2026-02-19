'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, TrendingUp, Calendar, Users, ArrowLeft, Info, Loader2, ChevronRight } from 'lucide-react';
import { supabase } from '@/utils/supabaseClient';
import HowAutoNudgeWorksModal from './Modals/HowAutoNudgeWorksModal';

interface BarberNudgeCampaign {
  message_id: string;
  iso_week_number: string;
  week_start: string;
  week_end: string;
  clients_booked: number;
  date_sent: string;
}

interface SMSRecipient {
  client_id: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  phone_normalized: string | null;
  status: 'booked' | 'pending';
  service?: string;
  price?: string;
  appointment_date?: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

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

      const { data: scheduledMessages, error } = await supabase
        .from('sms_scheduled_messages')
        .select('id, title, created_at')
        .eq('user_id', user.id)
        .eq('purpose', 'auto-nudge')
        .like('title', `${user.id}_%`)
        .order('created_at', { ascending: false });

      if (error || !scheduledMessages?.length) {
        setCampaigns([]);
        return;
      }

      const campaignList: BarberNudgeCampaign[] = [];
      const seenWeeks = new Set<string>();

      for (const message of scheduledMessages) {
        const parts = message.title.split('_');
        if (parts.length !== 2) continue;
        const isoWeek = parts[1];
        if (seenWeeks.has(isoWeek)) continue;
        seenWeeks.add(isoWeek);

        const { data: successData } = await supabase
          .from('barber_nudge_success')
          .select('client_ids')
          .eq('user_id', user.id)
          .eq('iso_week_number', isoWeek)
          .single();

        const { data: sentData } = await supabase
          .from('sms_sent')
          .select('created_at')
          .eq('message_id', message.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const { start, end } = getISOWeekDates(isoWeek);
        campaignList.push({
          message_id: message.id,
          iso_week_number: isoWeek,
          week_start: start,
          week_end: end,
          clients_booked: successData?.client_ids?.length || 0,
          date_sent: sentData?.created_at || message.created_at,
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

      const { data: smsSent, error: smsError } = await supabase
        .from('sms_sent')
        .select('client_id, phone_normalized')
        .eq('message_id', campaign.message_id)
        .eq('is_sent', true)
        .order('created_at', { ascending: true });

      if (smsError || !smsSent?.length) {
        setRecipients([]);
        setView('details');
        return;
      }

      const { data: successData } = await supabase
        .from('barber_nudge_success')
        .select('client_ids, services, prices, appointment_dates')
        .eq('user_id', user.id)
        .eq('iso_week_number', campaign.iso_week_number)
        .single();

      const bookedClientIds = successData?.client_ids || [];
      const services = successData?.services || [];
      const prices = successData?.prices || [];
      const appointmentDates = successData?.appointment_dates || [];

      const allClientIds = smsSent.map(s => s.client_id).filter((id): id is string => id !== null);
      const allPhones = smsSent.map(s => s.phone_normalized).filter((p): p is string => p !== null);

      const { data: clientsData } = await supabase
        .from('acuity_clients')
        .select('client_id, first_name, last_name, phone, phone_normalized')
        .eq('user_id', user.id)
        .or(`client_id.in.(${allClientIds.join(',')}),phone_normalized.in.(${allPhones.map(p => `"${p}"`).join(',')})`);

      const clientsMap = new Map(
        (clientsData || []).map(c => [c.client_id || c.phone_normalized, c])
      );

      const recipientsList: SMSRecipient[] = smsSent.map(sms => {
        const key = sms.client_id || sms.phone_normalized;
        const client = key ? clientsMap.get(key) : null;
        const bookedIndex = sms.client_id ? bookedClientIds.indexOf(sms.client_id) : -1;
        const isBooked = bookedIndex !== -1;
        return {
          client_id: sms.client_id,
          first_name: client?.first_name || null,
          last_name: client?.last_name || null,
          phone: client?.phone || null,
          phone_normalized: sms.phone_normalized,
          status: isBooked ? 'booked' : 'pending',
          service: isBooked ? services[bookedIndex] : undefined,
          price: isBooked ? prices[bookedIndex] : undefined,
          appointment_date: isBooked ? appointmentDates[bookedIndex] : undefined,
        };
      });

      const sorted = recipientsList.sort((a, b) => {
        if (a.status === 'booked' && b.status === 'booked') {
          return new Date(a.appointment_date!).getTime() - new Date(b.appointment_date!).getTime();
        }
        if (a.status === 'booked') return -1;
        if (b.status === 'booked') return 1;
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
                      key={campaign.message_id}
                      onClick={() => handleCampaignClick(campaign)}
                      className="w-full flex items-center gap-4 px-4 sm:px-6 py-4 hover:bg-white/5 transition-colors text-left group"
                    >
                      {/* Week badge */}
                      <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/5 border border-white/8 flex flex-col items-center justify-center">
                        <span className="text-[9px] text-white/30 font-semibold uppercase tracking-wide">Wk</span>
                        <span className="text-sm sm:text-base font-bold text-white leading-none">
                          {campaign.iso_week_number.split('-W')[1]}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm sm:text-base font-semibold text-white truncate">
                          {campaign.week_start} – {campaign.week_end}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Calendar className="w-3 h-3 text-white/30 flex-shrink-0" />
                          <p className="text-xs text-white/40 truncate">Sent {formatDate(campaign.date_sent)}</p>
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
                      Sent {selectedCampaign && formatDate(selectedCampaign.date_sent)}
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
                  {recipients.map((recipient, index) => (
                    <div
                      key={`${recipient.client_id || recipient.phone_normalized}-${index}`}
                      className={`rounded-xl border p-4 flex flex-col gap-3 ${
                        recipient.status === 'booked'
                          ? 'bg-lime-300/5 border-lime-300/15'
                          : 'bg-white/[0.03] border-white/8'
                      }`}
                    >
                      {/* Single row: name + phone + badge */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-sm font-bold text-white truncate">
                            {recipient.first_name && recipient.last_name
                              ? capitalizeName(`${recipient.first_name} ${recipient.last_name}`)
                              : <span className="text-white/30 font-normal">Unknown Client</span>
                            }
                          </p>
                          <span className="text-xs text-white/25 flex-shrink-0">
                            {formatPhoneNumber(recipient.phone_normalized || recipient.phone)}
                          </span>
                        </div>
                        <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          recipient.status === 'booked'
                            ? 'bg-lime-300/10 text-lime-300 border-lime-300/20'
                            : 'bg-amber-300/10 text-amber-300 border-amber-300/20'
                        }`}>
                          {recipient.status === 'booked' ? '✓ Booked' : 'Pending'}
                        </span>
                      </div>

                      {/* Booking details — only if booked */}
                      {recipient.status === 'booked' && recipient.service && (
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
                  ))}
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