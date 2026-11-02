'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, TrendingUp, Calendar, Users, ArrowLeft, Info, Loader2, ChevronRight, CheckCircle } from 'lucide-react';
import { EmptyState } from '@/components/ui/AppKit';
import { supabase } from '@/utils/supabaseClient';
import HowAutoNudgeWorksModal from './Modals/HowAutoNudgeWorksModal';

interface BarberNudgeCampaign {
  bucket_id: string;
  iso_week_number: string;
  week_start: string;
  week_end: string;
  clients_booked: number;
  total_clients: number;
  campaign_start: string;
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

      const { data: buckets, error } = await supabase
        .from('sms_smart_buckets')
        .select('bucket_id, iso_week, campaign_start, total_clients')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('campaign_start', { ascending: false });

      if (error || !buckets?.length) {
        setCampaigns([]);
        return;
      }

      const isoWeeks = buckets.map(b => b.iso_week);
      const { data: successRows } = await supabase
        .from('barber_nudge_success')
        .select('iso_week_number, client_ids')
        .eq('user_id', user.id)
        .in('iso_week_number', isoWeeks);

      const successMap = new Map(
        (successRows || []).map(row => [row.iso_week_number, row.client_ids?.length || 0])
      );

      const campaignList: BarberNudgeCampaign[] = buckets.map(bucket => {
        const { start, end } = getISOWeekDates(bucket.iso_week);
        return {
          bucket_id: bucket.bucket_id,
          iso_week_number: bucket.iso_week,
          week_start: start,
          week_end: end,
          clients_booked: successMap.get(bucket.iso_week) || 0,
          total_clients: bucket.total_clients || 0,
          campaign_start: bucket.campaign_start,
        };
      });

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
        .eq('smart_bucket_id', campaign.bucket_id)
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
                      {/* Week badge */}
                      <div className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-raised border border-white/[0.07] flex flex-col items-center justify-center">
                        <span className="text-[9px] text-gray-500 font-semibold uppercase tracking-wide">Wk</span>
                        <span className="text-sm font-semibold text-ivory leading-none tabular-nums">
                          {campaign.iso_week_number.split('-W')[1]}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-ivory truncate tabular-nums">
                          {campaign.week_start} – {campaign.week_end}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Calendar className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" strokeWidth={1.75} />
                          <p className="text-xs text-muted truncate tabular-nums">
                            Started {formatDate(campaign.campaign_start)} · {campaign.total_clients} clients nudged
                          </p>
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
                        <span className="text-gray-600">·</span>
                        <span className="text-muted">
                          {selectedCampaign.total_clients} nudged
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
                  {recipients.map((recipient, index) => (
                    <div
                      key={`${recipient.client_id || recipient.phone_normalized}-${index}`}
                      className={`rounded-lg border p-3.5 flex flex-col gap-3 ${
                        recipient.status === 'booked'
                          ? 'bg-sage/[0.04] border-sage/20'
                          : 'bg-white/[0.02] border-white/[0.07]'
                      }`}
                    >
                      {/* Single row: name + phone + badge */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-sm font-semibold text-ivory truncate">
                            {recipient.first_name && recipient.last_name
                              ? capitalizeName(`${recipient.first_name} ${recipient.last_name}`)
                              : <span className="text-gray-500 font-normal">Unknown Client</span>
                            }
                          </p>
                          <span className="text-xs text-gray-500 flex-shrink-0 tabular-nums">
                            {formatPhoneNumber(recipient.phone_normalized || recipient.phone)}
                          </span>
                        </div>
                        <span className={`badge flex-shrink-0 ${
                          recipient.status === 'booked' ? 'badge-sage' : 'badge-warn'
                        }`}>
                          {recipient.status === 'booked' ? (
                            <><CheckCircle className="w-3 h-3" strokeWidth={2} /> Booked</>
                          ) : 'Pending'}
                        </span>
                      </div>

                      {/* Booking details — only if booked */}
                      {recipient.status === 'booked' && recipient.service && (
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
