import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Users, ArrowLeft, Loader2, TrendingUp, CheckCircle, Clock } from 'lucide-react';
import { EmptyState } from '@/components/ui/AppKit';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabaseClient';

interface BarberNudgeHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

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

export default function BarberNudgeHistoryModal({ isOpen, onClose }: BarberNudgeHistoryModalProps) {
  const [view, setView] = useState<'list' | 'details'>('list');
  const [campaigns, setCampaigns] = useState<BarberNudgeCampaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<BarberNudgeCampaign | null>(null);
  const [recipients, setRecipients] = useState<SMSRecipient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchCampaigns();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setView('list');
      setSelectedCampaign(null);
      setRecipients([]);
    }
  }, [isOpen]);

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

    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    };

    return {
      start: formatDate(monday),
      end: formatDate(sunday)
    };
  };

  const fetchCampaigns = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Query sms_smart_buckets directly — this is the source of truth for campaigns
      const { data: buckets, error: bucketsError } = await supabase
        .from('sms_smart_buckets')
        .select('bucket_id, iso_week, campaign_start, total_clients')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('campaign_start', { ascending: false });

      if (bucketsError || !buckets || buckets.length === 0) {
        setCampaigns([]);
        return;
      }

      // Fetch barber_nudge_success for all weeks at once
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

      // Get all SMS sent for this bucket
      const { data: smsSent, error: smsError } = await supabase
        .from('sms_sent')
        .select('client_id, phone_normalized')
        .eq('smart_bucket_id', campaign.bucket_id)
        .eq('is_sent', true)
        .order('created_at', { ascending: true });

      if (smsError || !smsSent || smsSent.length === 0) {
        setRecipients([]);
        if (!smsError) setView('details');
        return;
      }

      // Get barber_nudge_success data
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

      const allClientIds = smsSent
        .map(sms => sms.client_id)
        .filter((id): id is string => id !== null);

      const allPhoneNumbers = smsSent
        .map(sms => sms.phone_normalized)
        .filter((phone): phone is string => phone !== null);

      // Fetch client details
      const { data: clientsData } = await supabase
        .from('acuity_clients')
        .select('client_id, first_name, last_name, phone, phone_normalized')
        .eq('user_id', user.id)
        .or(`client_id.in.(${allClientIds.join(',')}),phone_normalized.in.(${allPhoneNumbers.map(p => `"${p}"`).join(',')})`);

      const clientsMap = new Map(
        (clientsData || []).map(client => [
          client.client_id || client.phone_normalized,
          client
        ])
      );

      const recipientsList: SMSRecipient[] = smsSent.map(sms => {
        const clientKey = sms.client_id || sms.phone_normalized;
        const client = clientKey ? clientsMap.get(clientKey) : null;

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

      const sortedRecipients = recipientsList.sort((a, b) => {
        if (a.status === 'booked' && b.status === 'booked') {
          const dateA = new Date(a.appointment_date!).getTime();
          const dateB = new Date(b.appointment_date!).getTime();
          return dateA - dateB;
        }
        if (a.status === 'booked') return -1;
        if (b.status === 'booked') return 1;
        return 0;
      });

      setRecipients(sortedRecipients);
      setView('details');
    } catch (error) {
      console.error('Failed to fetch recipients:', error);
      setRecipients([]);
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const formatPhoneNumber = (phone: string | null) => {
    if (!phone) return 'No phone';
    const digits = phone.replace(/\D/g, '');
    const phoneDigits = digits.length === 11 && digits.startsWith('1')
      ? digits.slice(1)
      : digits;

    if (phoneDigits.length === 10) {
      return `(${phoneDigits.slice(0, 3)}) ${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6, 10)}`;
    }
    return phone;
  };

  const formatAppointmentDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const capitalizeName = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="modal-backdrop !z-[70] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="modal-surface w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[80vw] xl:w-[70vw] max-w-5xl h-[70vh] sm:h-[80vh] flex flex-col overflow-hidden"
          >
            <AnimatePresence mode="wait">
              {view === 'list' && (
                <motion.div
                  key="list"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col h-full"
                >
                  {/* Modal Header */}
                  <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-white/[0.07] flex-shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <TrendingUp className="w-[18px] h-[18px] text-sage flex-shrink-0" strokeWidth={1.75} />
                      <div className="min-w-0">
                        <h3 className="text-[15px] font-semibold text-ivory truncate">Barber Nudge history</h3>
                        <p className="text-xs text-muted mt-0.5">
                          Track your weekly barber nudge campaign success
                        </p>
                      </div>
                    </div>
                    <button onClick={onClose} className="btn btn-ghost btn-sm !h-8 !px-2 flex-shrink-0" aria-label="Close">
                      <X className="w-4 h-4" strokeWidth={1.75} />
                    </button>
                  </div>

                  {/* Campaigns List */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-5 min-h-0">
                    {isLoading ? (
                      <div className="empty-state">
                        <Loader2 className="animate-spin" strokeWidth={1.75} />
                        <p>Updating your campaign history...</p>
                      </div>
                    ) : campaigns.length === 0 ? (
                      <EmptyState icon={TrendingUp} title="No barber nudge campaigns yet">
                        Successful campaigns will appear here
                      </EmptyState>
                    ) : (
                      <div className="space-y-2">
                        {campaigns.map((campaign) => (
                          <button
                            key={campaign.bucket_id}
                            onClick={() => handleCampaignClick(campaign)}
                            className="w-full p-4 bg-white/[0.02] border border-white/[0.07] rounded-lg hover:bg-white/[0.04] hover:border-white/[0.12] transition-colors text-left group"
                          >
                            <div className="flex items-start justify-between mb-2 gap-2">
                              <h4 className="font-semibold text-ivory text-sm tabular-nums">
                                {campaign.week_start} - {campaign.week_end}
                              </h4>
                              <span className="badge badge-sage flex-shrink-0 tabular-nums">
                                {campaign.clients_booked} booked
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted flex-wrap tabular-nums">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.75} />
                                Started {formatDate(campaign.campaign_start)}
                              </span>
                              <span className="hidden sm:inline text-gray-600">·</span>
                              <span>Week {campaign.iso_week_number.split('-W')[1]}</span>
                              <span className="hidden sm:inline text-gray-600">·</span>
                              <span>{campaign.total_clients} clients nudged</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex justify-end border-t border-white/[0.07] px-4 sm:px-5 py-3.5 flex-shrink-0">
                    <button onClick={onClose} className="btn btn-glass btn-sm w-full sm:w-auto">
                      Close
                    </button>
                  </div>
                </motion.div>
              )}

              {view === 'details' && selectedCampaign && (
                <motion.div
                  key="details"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col h-full"
                >
                  {/* Modal Header */}
                  <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-white/[0.07] flex-shrink-0">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <button onClick={handleBack} className="btn btn-ghost btn-sm !h-8 !px-2 flex-shrink-0" aria-label="Back">
                        <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[15px] font-semibold text-ivory truncate tabular-nums">
                          {selectedCampaign.week_start} - {selectedCampaign.week_end}
                        </h3>
                        <p className="text-xs text-muted mt-0.5 truncate">
                          Started {formatDate(selectedCampaign.campaign_start)}
                        </p>
                      </div>
                    </div>
                    <button onClick={onClose} className="btn btn-ghost btn-sm !h-8 !px-2 flex-shrink-0" aria-label="Close">
                      <X className="w-4 h-4" strokeWidth={1.75} />
                    </button>
                  </div>

                  {/* Stats Bar */}
                  <div className="px-4 sm:px-5 py-3 border-b border-white/[0.07] bg-white/[0.02] flex-shrink-0">
                    <div className="flex gap-6">
                      <div>
                        <p className="stat-label mb-0.5">Clients booked</p>
                        <p className="text-base font-semibold text-sage-bright tabular-nums">{selectedCampaign.clients_booked}</p>
                      </div>
                      <div>
                        <p className="stat-label mb-0.5">Clients nudged</p>
                        <p className="text-base font-semibold text-ivory tabular-nums">{selectedCampaign.total_clients}</p>
                      </div>
                      <div>
                        <p className="stat-label mb-0.5">Week</p>
                        <p className="text-base font-semibold text-ivory tabular-nums">
                          {selectedCampaign.iso_week_number.split('-W')[1]}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Recipients List */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-5 min-h-0">
                    {loadingRecipients ? (
                      <div className="empty-state">
                        <Loader2 className="animate-spin" strokeWidth={1.75} />
                        <p>Loading recipients...</p>
                      </div>
                    ) : recipients.length === 0 ? (
                      <EmptyState icon={Users} title="No recipients found" />
                    ) : (
                      <div className="space-y-2">
                        {recipients.map((recipient, index) => (
                          <div
                            key={`${recipient.client_id || recipient.phone_normalized}-${index}`}
                            className={`p-4 rounded-lg border transition-colors ${
                              recipient.status === 'booked'
                                ? 'bg-sage/[0.04] border-sage/20 hover:border-sage/30'
                                : 'bg-white/[0.02] border-white/[0.07] hover:border-white/[0.12]'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 sm:gap-4">
                              <div className="flex-1 min-w-0">
                                {recipient.first_name && recipient.last_name ? (
                                  <h4 className="font-semibold text-ivory text-sm mb-0.5">
                                    {capitalizeName(`${recipient.first_name} ${recipient.last_name}`)}
                                  </h4>
                                ) : (
                                  <h4 className="font-semibold text-muted text-sm mb-0.5">Unknown Client</h4>
                                )}
                                <p className="text-xs text-muted tabular-nums">
                                  {formatPhoneNumber(recipient.phone_normalized || recipient.phone)}
                                </p>
                              </div>
                              <span className={`badge flex-shrink-0 ${
                                recipient.status === 'booked' ? 'badge-sage' : 'badge-warn'
                              }`}>
                                {recipient.status === 'booked' ? (
                                  <><CheckCircle className="w-3 h-3" strokeWidth={2} /> Booked</>
                                ) : (
                                  <><Clock className="w-3 h-3" strokeWidth={2} /> Pending</>
                                )}
                              </span>
                            </div>

                            {recipient.status === 'booked' && recipient.service && recipient.appointment_date && (
                              <div className="mt-3 pt-3 border-t border-white/[0.07]">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[11px] text-muted mb-0.5">Service</p>
                                    <p className="text-[13px] font-medium text-ivory truncate">{recipient.service}</p>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[11px] text-muted mb-0.5">Appointment</p>
                                    <p className="text-[13px] font-medium text-ivory break-words tabular-nums">{formatAppointmentDate(recipient.appointment_date)}</p>
                                  </div>
                                  {recipient.price && (
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[11px] text-muted mb-0.5">Price</p>
                                      <p className="text-[13px] font-semibold text-sage-bright tabular-nums">${recipient.price}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex justify-end border-t border-white/[0.07] px-4 sm:px-5 py-3.5 flex-shrink-0">
                    <button onClick={handleBack} className="btn btn-glass btn-sm w-full sm:w-auto">
                      Back to history
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
