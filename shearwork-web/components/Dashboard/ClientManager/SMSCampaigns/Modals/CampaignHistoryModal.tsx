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
          className="modal-backdrop z-[70] flex items-center justify-center p-2 sm:p-4 min-h-screen"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="modal-surface w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden mb-16 sm:mb-0"
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
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[15px] font-semibold text-ivory flex items-center gap-2">
                        <Clock className="w-[18px] h-[18px] text-gray-500 flex-shrink-0" strokeWidth={1.75} />
                        <span className="truncate">Campaign History</span>
                      </h3>
                      <p className="text-[13px] text-muted mt-0.5 hidden sm:block">
                        View your past SMS campaigns and their performance
                      </p>
                    </div>
                    <button onClick={onClose} className="btn btn-ghost btn-sm !h-8 !px-2 flex-shrink-0" aria-label="Close">
                      <X className="w-4 h-4" strokeWidth={1.75} />
                    </button>
                  </div>

                  {/* Campaigns List */}
                  <div className="flex-1 overflow-y-auto p-3 sm:p-5 min-h-0">
                    {isLoading ? (
                      <div className="empty-state">
                        <Loader2 className="animate-spin" strokeWidth={1.75} />
                        <p>Loading campaigns...</p>
                      </div>
                    ) : campaigns.length === 0 ? (
                      <div className="empty-state">
                        <Clock strokeWidth={1.75} />
                        <strong>No completed campaigns yet</strong>
                        <p className="text-[13px]">Completed campaigns will appear here</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {campaigns.map((campaign) => (
                          <button
                            key={campaign.id}
                            onClick={() => handleCampaignClick(campaign)}
                            className="w-full p-3 sm:p-4 bg-raised border border-white/[0.07] rounded-lg hover:border-white/[0.12] hover:bg-white/[0.04] transition-colors text-left group"
                          >
                            <div className="flex items-center justify-between mb-2 gap-2">
                              <h4 className="font-semibold text-ivory text-sm truncate flex-1">
                                {campaign.title}
                              </h4>
                              <span className="badge badge-sage flex-shrink-0">
                                Completed
                              </span>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3 text-xs text-muted flex-wrap tabular-nums">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 flex-shrink-0" strokeWidth={1.75} />
                                {formatDate(campaign.cron)}
                              </span>
                              <span className="hidden sm:inline text-gray-500">·</span>
                              <span>{campaign.final_clients_to_message || 0} recipients</span>
                              <span className="hidden sm:inline text-gray-500">·</span>
                              <span className="text-sage">{campaign.success} sent</span>
                              <span className="hidden xs:inline text-gray-500">·</span>
                              <span className="text-[#FF8F7D] hidden xs:inline">{campaign.fail || 0} failed</span>
                              {((campaign.success / (campaign.success + (campaign.fail || 0))) * 100) > 0 && (
                                <>
                                  <span className="hidden sm:inline text-gray-500">·</span>
                                  <span className="text-[#9CCBFF] hidden sm:inline">
                                    {((campaign.success / (campaign.success + (campaign.fail || 0))) * 100).toFixed(1)}% rate
                                  </span>
                                </>
                              )}
                            </div>
                            <div className="mt-2 text-xs text-gray-500 line-clamp-2 sm:line-clamp-1">
                              {campaign.message}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex justify-end border-t border-white/[0.07] px-4 sm:px-5 py-3 flex-shrink-0">
                    <button onClick={onClose} className="btn btn-glass btn-sm">
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
                  <div className="flex items-center justify-between gap-3 px-3 sm:px-5 py-3 sm:py-4 border-b border-white/[0.07] flex-shrink-0">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <button onClick={handleBack} className="btn btn-ghost btn-sm !h-8 !px-2 flex-shrink-0" aria-label="Back">
                        <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[15px] font-semibold text-ivory truncate">{selectedCampaign.title}</h3>
                        <p className="text-xs text-muted mt-0.5 truncate">
                          {formatDate(selectedCampaign.cron)}
                        </p>
                      </div>
                    </div>
                    <button onClick={onClose} className="btn btn-ghost btn-sm !h-8 !px-2 flex-shrink-0" aria-label="Close">
                      <X className="w-4 h-4" strokeWidth={1.75} />
                    </button>
                  </div>

                  {/* Stats Bar */}
                  {recipientsStats && (
                    <div className="px-3 sm:px-5 py-3 border-b border-white/[0.07] flex-shrink-0">
                      <div className="flex gap-5 sm:gap-8 mb-3">
                        <div>
                          <p className="stat-label mb-1">Total</p>
                          <p className="text-lg font-semibold text-ivory tabular-nums">{recipientsStats.total}</p>
                        </div>
                        <div>
                          <p className="stat-label mb-1">Successful</p>
                          <p className="text-lg font-semibold text-sage tabular-nums">{recipientsStats.successful}</p>
                        </div>
                        <div>
                          <p className="stat-label mb-1">Failed</p>
                          <p className="text-lg font-semibold text-[#FF8F7D] tabular-nums">{recipientsStats.failed || 0}</p>
                        </div>
                        {((recipientsStats.successful / (recipientsStats.successful + (recipientsStats.failed || 0))) * 100) > 0 && (
                          <div className="hidden xs:block">
                            <p className="stat-label mb-1">Success Rate</p>
                            <p className="text-lg font-semibold text-ivory tabular-nums">
                              {((recipientsStats.successful / (recipientsStats.successful + (recipientsStats.failed || 0))) * 100).toFixed(1)}%
                            </p>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted border-t border-white/[0.07] pt-2 line-clamp-2">
                        {selectedCampaign.message}
                      </p>
                    </div>
                  )}

                  {/* Recipients List */}
                  <div className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-0">
                    {loadingRecipients ? (
                      <div className="empty-state">
                        <Loader2 className="animate-spin" strokeWidth={1.75} />
                        <p>Loading recipients...</p>
                      </div>
                    ) : recipients.length === 0 ? (
                      <div className="empty-state">
                        <Users strokeWidth={1.75} />
                        <p>No recipients found</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {recipients.map((recipient, index) => (
                          <div
                            key={index}
                            className="p-2.5 rounded-lg border border-white/[0.07] bg-raised hover:border-white/[0.12] transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {recipient.first_name && recipient.last_name ? (
                                    <h4 className="font-semibold text-ivory text-[13px] truncate">
                                      {recipient.first_name} {recipient.last_name}
                                    </h4>
                                  ) : (
                                    <h4 className="font-semibold text-muted text-[13px]">Unknown Client</h4>
                                  )}
                                  <span className={`badge flex-shrink-0 ${
                                    recipient.is_sent
                                      ? 'badge-sage'
                                      : 'badge-danger'
                                  }`}>
                                    {recipient.is_sent ? 'Sent' : 'Failed'}
                                  </span>
                                  {!recipient.is_sent && recipient.reason && (
                                    <span className="flex items-center gap-1 text-[11px] text-[#FF8F7D] min-w-0">
                                      <AlertCircle className="w-3 h-3 flex-shrink-0" strokeWidth={1.75} />
                                      <span className="truncate">{recipient.reason}</span>
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5 tabular-nums">
                                  {recipient.phone_normalized}
                                </p>
                              </div>
                              <div className="flex-shrink-0">
                                {recipient.is_sent ? (
                                  <CheckCircle className="w-4 h-4 text-sage" strokeWidth={1.75} />
                                ) : (
                                  <XCircle className="w-4 h-4 text-[#FF8F7D]" strokeWidth={1.75} />
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex justify-end border-t border-white/[0.07] px-3 sm:px-5 py-3 flex-shrink-0">
                    <button onClick={handleBack} className="btn btn-glass btn-sm">
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
