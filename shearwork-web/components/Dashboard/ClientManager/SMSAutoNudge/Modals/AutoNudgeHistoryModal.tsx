import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Users, ArrowLeft, Loader2, TrendingUp } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabaseClient';

interface BarberNudgeHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

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

export default function BarberNudgeHistoryModal({ isOpen, onClose }: BarberNudgeHistoryModalProps) {
  const [view, setView] = useState<'list' | 'details'>('list');
  const [campaigns, setCampaigns] = useState<BarberNudgeCampaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<BarberNudgeCampaign | null>(null);
  const [recipients, setRecipients] = useState<SMSRecipient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  // Fetch campaigns on modal open
  useEffect(() => {
    if (isOpen) {
      fetchCampaigns();
    }
  }, [isOpen]);

  // Reset view when modal closes
  useEffect(() => {
    if (!isOpen) {
      setView('list');
      setSelectedCampaign(null);
      setRecipients([]);
    }
  }, [isOpen]);

  const getISOWeekDates = (isoWeek: string): { start: string; end: string } => {
    // Parse "2026-W05" format
    const [yearStr, weekStr] = isoWeek.split('-W');
    const year = parseInt(yearStr);
    const week = parseInt(weekStr);

    // Calculate the date of the Monday of the ISO week
    const jan4 = new Date(year, 0, 4); // January 4th is always in week 1
    const jan4Day = jan4.getDay() || 7; // Convert Sunday (0) to 7
    const firstMonday = new Date(jan4);
    firstMonday.setDate(jan4.getDate() - jan4Day + 1);

    // Calculate the Monday of the target week
    const monday = new Date(firstMonday);
    monday.setDate(firstMonday.getDate() + (week - 1) * 7);

    // Calculate Sunday
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
      if (!user) {
        console.error('No user found');
        return;
      }

      // Get all sms_scheduled_messages that match the pattern {user_id}_{iso_week}
      const { data: scheduledMessages, error: schedError } = await supabase
        .from('sms_scheduled_messages')
        .select('id, title, created_at')
        .eq('user_id', user.id)
        .eq('purpose', 'auto-nudge')
        .like('title', `${user.id}_%`)
        .order('created_at', { ascending: false });

      if (schedError) {
        console.error('Error fetching scheduled messages:', schedError);
        return;
      }

      if (!scheduledMessages || scheduledMessages.length === 0) {
        setCampaigns([]);
        return;
      }

      const campaignList: BarberNudgeCampaign[] = [];

      for (const message of scheduledMessages) {
        // Parse title to get user_id and iso_week
        const parts = message.title.split('_');
        if (parts.length !== 2) continue;

        const isoWeek = parts[1];

        // Get barber_nudge_success data
        const { data: successData, error: successError } = await supabase
          .from('barber_nudge_success')
          .select('client_ids')
          .eq('user_id', user.id)
          .eq('iso_week_number', isoWeek)
          .single();

        // Skip if no success data or no clients booked
        if (successError || !successData || !successData.client_ids || successData.client_ids.length === 0) {
          continue;
        }

        // Get latest sms_sent created_at for this message
        const { data: sentData, error: sentError } = await supabase
          .from('sms_sent')
          .select('created_at')
          .eq('message_id', message.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const dateSent = sentData?.created_at || message.created_at;

        const { start, end } = getISOWeekDates(isoWeek);

        campaignList.push({
          message_id: message.id,
          iso_week_number: isoWeek,
          week_start: start,
          week_end: end,
          clients_booked: successData.client_ids.length,
          date_sent: dateSent
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
      if (!user) {
        console.error('No user found');
        return;
      }

      // Get all SMS sent for this message
      const { data: smsSent, error: smsError } = await supabase
        .from('sms_sent')
        .select('client_id, phone_normalized')
        .eq('message_id', campaign.message_id)
        .eq('is_sent', true)
        .order('created_at', { ascending: true });

      if (smsError) {
        console.error('Error fetching SMS sent:', smsError);
        setRecipients([]);
        return;
      }

      if (!smsSent || smsSent.length === 0) {
        setRecipients([]);
        return;
      }

      // Get barber_nudge_success data
      const { data: successData, error: successError } = await supabase
        .from('barber_nudge_success')
        .select('client_ids, services, prices, appointment_dates')
        .eq('user_id', user.id)
        .eq('iso_week_number', campaign.iso_week_number)
        .single();

      const bookedClientIds = successData?.client_ids || [];
      const services = successData?.services || [];
      const prices = successData?.prices || []
      const appointmentDates = successData?.appointment_dates || [];

      // Get all unique client IDs and phone numbers from SMS sent
      const allClientIds = smsSent
        .map(sms => sms.client_id)
        .filter((id): id is string => id !== null);
      
      const allPhoneNumbers = smsSent
        .map(sms => sms.phone_normalized)
        .filter((phone): phone is string => phone !== null);

      // Fetch client details
      const { data: clientsData, error: clientsError } = await supabase
        .from('acuity_clients')
        .select('client_id, first_name, last_name, phone, phone_normalized')
        .eq('user_id', user.id)
        .or(`client_id.in.(${allClientIds.join(',')}),phone_normalized.in.(${allPhoneNumbers.map(p => `"${p}"`).join(',')})`);

      if (clientsError) {
        console.error('Error fetching clients:', clientsError);
      }

      const clientsMap = new Map(
        (clientsData || []).map(client => [
          client.client_id || client.phone_normalized,
          client
        ])
      );

      // Build recipients list
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
          price: isBooked ? prices [bookedIndex] : undefined, 
          appointment_date: isBooked ? appointmentDates[bookedIndex] : undefined,
        };
      });

      // Sort: booked first (by appointment date), then pending (by send order)
      const sortedRecipients = recipientsList.sort((a, b) => {
        if (a.status === 'booked' && b.status === 'booked') {
          const dateA = new Date(a.appointment_date!).getTime();
          const dateB = new Date(b.appointment_date!).getTime();
          return dateA - dateB;
        }
        if (a.status === 'booked') return -1;
        if (b.status === 'booked') return 1;
        return 0; // Maintain send order for pending
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[80vw] xl:w-[70vw] max-w-5xl h-[70vh] sm:h-[80vh] flex flex-col overflow-hidden"
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
                  <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/10 bg-gradient-to-r from-lime-500/10 to-emerald-500/10 flex-shrink-0">
                    <div className="flex-1 min-w-0 pr-2">
                      <h3 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-lime-300 flex-shrink-0" />
                        <span className="truncate">Barber Nudge History</span>
                      </h3>
                      <p className="text-sm text-[#bdbdbd] mt-1 hidden sm:block">
                        Track your weekly barber nudge campaign success
                      </p>
                    </div>
                    <button
                      onClick={onClose}
                      className="p-2 hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
                    >
                      <X className="w-5 h-5 text-[#bdbdbd]" />
                    </button>
                  </div>

                  {/* Campaigns List */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0">
                    {isLoading ? (
                      <div className="text-center py-12">
                        <Loader2 className="w-8 h-8 text-lime-300 animate-spin mx-auto mb-4" />
                        <p className="text-base text-[#bdbdbd]">Loading campaigns...</p>
                      </div>
                    ) : campaigns.length === 0 ? (
                      <div className="text-center py-12">
                        <TrendingUp className="w-12 h-12 text-[#bdbdbd] mx-auto mb-4 opacity-50" />
                        <p className="text-base text-[#bdbdbd]">No barber nudge campaigns yet</p>
                        <p className="text-sm text-[#bdbdbd] mt-2">
                          Successful campaigns will appear here
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {campaigns.map((campaign) => (
                          <button
                            key={campaign.message_id}
                            onClick={() => handleCampaignClick(campaign)}
                            className="w-full p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-lime-300/30 transition-all duration-300 text-left group"
                          >
                            <div className="flex items-start justify-between mb-2 gap-2">
                              <h4 className="font-semibold text-white group-hover:text-lime-300 transition-colors text-base">
                                {campaign.week_start} - {campaign.week_end}
                              </h4>
                              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-lime-300/10 text-lime-300 border border-lime-300/20 flex-shrink-0">
                                {campaign.clients_booked} booked
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-[#bdbdbd] flex-wrap">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 flex-shrink-0" />
                                Sent {formatDate(campaign.date_sent)}
                              </span>
                              <span className="hidden sm:inline">•</span>
                              <span className="text-lime-300">Week {campaign.iso_week_number.split('-W')[1]}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="border-t border-white/10 px-4 sm:px-6 py-4 bg-white/5 flex-shrink-0">
                    <button
                      onClick={onClose}
                      className="w-full px-6 py-3 rounded-xl font-bold text-base bg-white/10 text-white hover:bg-white/20 transition-all"
                    >
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
                  <div className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        onClick={handleBack}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
                      >
                        <ArrowLeft className="w-4 h-4 text-[#bdbdbd]" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-white truncate">
                          {selectedCampaign.week_start} - {selectedCampaign.week_end}
                        </h3>
                        <p className="text-xs text-[#bdbdbd] mt-0.5 truncate">
                          Sent {formatDate(selectedCampaign.date_sent)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={onClose}
                      className="p-2 hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
                    >
                      <X className="w-5 h-5 text-[#bdbdbd]" />
                    </button>
                  </div>

                  {/* Stats Bar */}
                  <div className="px-4 py-3 border-b border-white/10 bg-white/5 flex-shrink-0">
                    <div className="flex gap-4 text-xs">
                      <div>
                        <p className="text-[#bdbdbd] mb-0.5">Clients Booked</p>
                        <p className="text-base font-bold text-lime-300">{selectedCampaign.clients_booked}</p>
                      </div>
                      <div>
                        <p className="text-[#bdbdbd] mb-0.5">Week</p>
                        <p className="text-base font-bold text-white">
                          {selectedCampaign.iso_week_number.split('-W')[1]}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Recipients List */}
                  <div className="flex-1 overflow-y-auto p-4 min-h-0">
                    {loadingRecipients ? (
                      <div className="text-center py-12">
                        <Loader2 className="w-8 h-8 text-lime-300 animate-spin mx-auto mb-4" />
                        <p className="text-base text-[#bdbdbd]">Loading recipients...</p>
                      </div>
                    ) : recipients.length === 0 ? (
                      <div className="text-center py-8">
                        <Users className="w-10 h-10 text-[#bdbdbd] mx-auto mb-2 opacity-50" />
                        <p className="text-sm text-[#bdbdbd]">No recipients found</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {recipients.map((recipient, index) => (
                          <div
                            key={`${recipient.client_id || recipient.phone_normalized}-${index}`}
                            className={`p-4 rounded-xl border transition-all duration-200 ${
                              recipient.status === 'booked'
                                ? 'bg-gradient-to-br from-lime-300/10 to-lime-300/5 border-lime-300/30 hover:border-lime-300/50 hover:shadow-lg hover:shadow-lime-300/10'
                                : 'bg-gradient-to-br from-amber-300/10 to-amber-300/5 border-amber-300/30 hover:border-amber-300/50 hover:shadow-lg hover:shadow-amber-300/10'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 sm:gap-4 mb-3">
                              <div className="flex-1 min-w-0">
                                {recipient.first_name && recipient.last_name ? (
                                  <h4 className="font-bold text-white text-sm sm:text-base mb-1">
                                    {capitalizeName(`${recipient.first_name} ${recipient.last_name}`)}
                                  </h4>
                                ) : (
                                  <h4 className="font-bold text-[#bdbdbd] text-sm sm:text-base mb-1">Unknown Client</h4>
                                )}
                                <p className="text-xs sm:text-sm text-[#bdbdbd]">
                                  {formatPhoneNumber(recipient.phone_normalized || recipient.phone)}
                                </p>
                              </div>
                              <span className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold whitespace-nowrap flex-shrink-0 ${
                                recipient.status === 'booked'
                                  ? 'bg-lime-300/20 text-lime-300 border border-lime-300/30'
                                  : 'bg-amber-300/20 text-amber-300 border border-amber-300/30'
                              }`}>
                                {recipient.status === 'booked' ? '✓ Booked' : '○ Pending'}
                              </span>
                            </div>
                            
                            {recipient.status === 'booked' && recipient.service && recipient.appointment_date && (
                              <div className="pt-3 border-t border-white/10">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] sm:text-xs text-[#bdbdbd] mb-1">Service</p>
                                    <p className="text-sm font-semibold text-lime-300 truncate">{recipient.service}</p>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] sm:text-xs text-[#bdbdbd] mb-1">Appointment</p>
                                    <p className="text-xs sm:text-sm font-semibold text-white break-words">{formatAppointmentDate(recipient.appointment_date)}</p>
                                  </div>
                                  {recipient.price && (
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[10px] sm:text-xs text-[#bdbdbd] mb-1">Price</p>
                                      <p className="text-sm font-semibold text-lime-300">${recipient.price}</p>
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
                  <div className="border-t border-white/10 px-4 py-3 bg-white/5 flex-shrink-0">
                    <button
                      onClick={handleBack}
                      className="w-full px-4 py-2 rounded-lg font-semibold text-sm bg-white/10 text-white hover:bg-white/20 transition-all duration-300"
                    >
                      Back to History
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