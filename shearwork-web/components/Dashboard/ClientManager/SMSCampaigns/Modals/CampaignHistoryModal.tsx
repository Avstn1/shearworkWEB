import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Calendar, Users, CheckCircle, XCircle, AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabaseClient';

interface CampaignHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Campaign {
  id: string;
  title: string;
  message: string;
  cron: string;
  success: number;
  fail: number;
  purpose: string;
  final_clients_to_message: number;
  created_at: string;
}

interface Recipient {
  phone_normalized: string;
  is_sent: boolean;
  reason: string | null;
  created_at: string;
  client_id: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface RecipientStats {
  total: number;
  successful: number;
  failed: number;
}

export default function CampaignHistoryModal({ isOpen, onClose }: CampaignHistoryModalProps) {
  const [view, setView] = useState<'list' | 'details'>('list');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [recipientsStats, setRecipientsStats] = useState<RecipientStats | null>(null);
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
      setRecipientsStats(null);
    }
  }, [isOpen]);

  const fetchCampaigns = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('sms_scheduled_messages')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_finished', true)
        .in('purpose', ['campaign', 'mass'])
        // Don't filter by is_deleted - show all history
        .order('created_at', { ascending: false });

      if (error) throw error;

      setCampaigns(data || []);
    } catch (error) {
      console.error('Failed to fetch campaigns:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRecipients = async (messageId: string) => {
    setLoadingRecipients(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const response = await fetch(`/api/client-messaging/get-campaign-recipients?messageId=${messageId}&userId=${user.id}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch recipients');
      }

      const data = await response.json();
      
      if (data.success) {
        setRecipients(data.recipients || []);
        setRecipientsStats(data.stats || null);
        setView('details');
      }
    } catch (error) {
      console.error('Failed to fetch recipients:', error);
    } finally {
      setLoadingRecipients(false);
    }
  };

  const handleCampaignClick = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    fetchRecipients(campaign.id);
  };

  const handleBack = () => {
    setView('list');
    setSelectedCampaign(null);
    setRecipients([]);
    setRecipientsStats(null);
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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-2 sm:p-4 min-h-screen"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#1a1a1a] border border-white/10 rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden mb-16 sm:mb-0"
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
                  <div className="flex items-center justify-between p-3 sm:p-6 border-b border-white/10 bg-gradient-to-r from-purple-500/10 to-pink-500/10 flex-shrink-0">
                    <div className="flex-1 min-w-0 pr-2">
                      <h3 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2">
                        <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-purple-300 flex-shrink-0" />
                        <span className="truncate">Campaign History</span>
                      </h3>
                      <p className="text-xs sm:text-sm text-[#bdbdbd] mt-1 hidden sm:block">
                        View your past SMS campaigns and their performance
                      </p>
                    </div>
                    <button
                      onClick={onClose}
                      className="p-1.5 sm:p-2 hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
                    >
                      <X className="w-4 h-4 sm:w-5 sm:h-5 text-[#bdbdbd]" />
                    </button>
                  </div>

                  {/* Campaigns List */}
                  <div className="flex-1 overflow-y-auto p-3 sm:p-6 min-h-0">
                    {isLoading ? (
                      <div className="text-center py-12">
                        <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 text-purple-300 animate-spin mx-auto mb-4" />
                        <p className="text-sm sm:text-base text-[#bdbdbd]">Loading campaigns...</p>
                      </div>
                    ) : campaigns.length === 0 ? (
                      <div className="text-center py-12">
                        <Clock className="w-10 h-10 sm:w-12 sm:h-12 text-[#bdbdbd] mx-auto mb-4 opacity-50" />
                        <p className="text-sm sm:text-base text-[#bdbdbd]">No completed campaigns yet</p>
                        <p className="text-xs text-[#bdbdbd] mt-2">
                          Completed campaigns will appear here
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 sm:space-y-3">
                        {campaigns.map((campaign) => (
                          <button
                            key={campaign.id}
                            onClick={() => handleCampaignClick(campaign)}
                            className="w-full p-3 sm:p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-purple-300/30 transition-all duration-300 text-left group"
                          >
                            <div className="flex items-center justify-between mb-2 gap-2">
                              <h4 className="font-semibold text-white group-hover:text-purple-300 transition-colors text-sm sm:text-base truncate flex-1">
                                {campaign.title}
                              </h4>
                              <span className="px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-lime-300/10 text-lime-300 border border-lime-300/20 flex-shrink-0">
                                Completed
                              </span>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-[#bdbdbd] flex-wrap">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
                                {formatDate(campaign.cron)}
                              </span>
                              <span className="hidden sm:inline">•</span>
                              <span>{campaign.final_clients_to_message || 0} recipients</span>
                              <span className="hidden sm:inline">•</span>
                              <span className="text-lime-300">{campaign.success} sent</span>
                              <span className="hidden xs:inline">•</span>
                              <span className="text-rose-300 hidden xs:inline">{campaign.fail || 0} failed</span>
                              {((campaign.success / (campaign.success + (campaign.fail || 0))) * 100) > 0 && (
                                <>
                                  <span className="hidden sm:inline">•</span>
                                  <span className="text-sky-300 hidden sm:inline">
                                    {((campaign.success / (campaign.success + (campaign.fail || 0))) * 100).toFixed(1)}% rate
                                  </span>
                                </>
                              )}
                            </div>
                            <div className="mt-2 text-[10px] sm:text-xs text-[#bdbdbd] line-clamp-2 sm:line-clamp-1">
                              {campaign.message}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="border-t border-white/10 px-3 sm:px-6 py-3 sm:py-4 bg-white/5 flex-shrink-0">
                    <button
                      onClick={onClose}
                      className="w-full px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold text-sm sm:text-base bg-white/10 text-white hover:bg-white/20 transition-all"
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
                  <div className="flex items-center justify-between p-3 sm:p-4 border-b border-white/10 flex-shrink-0">
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <button
                        onClick={handleBack}
                        className="p-1.5 sm:p-2 hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
                      >
                        <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#bdbdbd]" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm sm:text-lg font-bold text-white truncate">{selectedCampaign.title}</h3>
                        <p className="text-[10px] sm:text-xs text-[#bdbdbd] mt-0.5 truncate">
                          {formatDate(selectedCampaign.cron)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={onClose}
                      className="p-1.5 hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
                    >
                      <X className="w-4 h-4 text-[#bdbdbd]" />
                    </button>
                  </div>

                  {/* Stats Bar */}
                  {recipientsStats && (
                    <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-white/10 bg-white/5 flex-shrink-0">
                      <div className="flex gap-3 sm:gap-4 text-[10px] sm:text-xs mb-2">
                        <div>
                          <p className="text-[#bdbdbd] mb-0.5">Total</p>
                          <p className="text-sm sm:text-base font-bold text-white">{recipientsStats.total}</p>
                        </div>
                        <div>
                          <p className="text-[#bdbdbd] mb-0.5">Successful</p>
                          <p className="text-sm sm:text-base font-bold text-lime-300">{recipientsStats.successful}</p>
                        </div>
                        <div>
                          <p className="text-[#bdbdbd] mb-0.5">Failed</p>
                          <p className="text-sm sm:text-base font-bold text-rose-300">{recipientsStats.failed || 0}</p>
                        </div>
                        {((recipientsStats.successful / (recipientsStats.successful + (recipientsStats.failed || 0))) * 100) > 0 && (
                          <div className="hidden xs:block">
                            <p className="text-[#bdbdbd] mb-0.5">Success Rate</p>
                            <p className="text-sm sm:text-base font-bold text-sky-300">
                              {((recipientsStats.successful / (recipientsStats.successful + (recipientsStats.failed || 0))) * 100).toFixed(1)}%
                            </p>
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] sm:text-xs text-white/60 border-t border-white/10 pt-2 line-clamp-2">
                        {selectedCampaign.message}
                      </p>
                    </div>
                  )}

                  {/* Recipients List */}
                  <div className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-0">
                    {loadingRecipients ? (
                      <div className="text-center py-12">
                        <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 text-sky-300 animate-spin mx-auto mb-4" />
                        <p className="text-sm sm:text-base text-[#bdbdbd]">Loading recipients...</p>
                      </div>
                    ) : recipients.length === 0 ? (
                      <div className="text-center py-8">
                        <Users className="w-8 h-8 sm:w-10 sm:h-10 text-[#bdbdbd] mx-auto mb-2 opacity-50" />
                        <p className="text-xs sm:text-sm text-[#bdbdbd]">No recipients found</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {recipients.map((recipient, index) => (
                          <div
                            key={index}
                            className={`p-2 sm:p-2.5 rounded-lg border transition-colors ${
                              recipient.is_sent
                                ? 'bg-lime-300/5 border-lime-300/20 hover:bg-lime-300/10'
                                : 'bg-rose-300/5 border-rose-300/20 hover:bg-rose-300/10'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                  {recipient.first_name && recipient.last_name ? (
                                    <h4 className="font-semibold text-white text-xs sm:text-sm truncate">
                                      {recipient.first_name} {recipient.last_name}
                                    </h4>
                                  ) : (
                                    <h4 className="font-semibold text-[#bdbdbd] text-xs sm:text-sm">Unknown Client</h4>
                                  )}
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold flex-shrink-0 ${
                                    recipient.is_sent
                                      ? 'bg-lime-300/20 text-lime-300'
                                      : 'bg-rose-300/20 text-rose-300'
                                  }`}>
                                    {recipient.is_sent ? 'Sent' : 'Failed'}
                                  </span>
                                  {!recipient.is_sent && recipient.reason && (
                                    <span className="flex items-center gap-1 text-[9px] sm:text-[10px] text-rose-300">
                                      <AlertCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
                                      <span className="truncate">{recipient.reason}</span>
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] sm:text-[11px] text-[#bdbdbd] mt-0.5">
                                  {recipient.phone_normalized}
                                </p>
                              </div>
                              <div className="flex-shrink-0">
                                {recipient.is_sent ? (
                                  <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-lime-300" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-300" />
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="border-t border-white/10 px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 flex-shrink-0">
                    <button
                      onClick={handleBack}
                      className="w-full px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm bg-white/10 text-white hover:bg-white/20 transition-all duration-300"
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