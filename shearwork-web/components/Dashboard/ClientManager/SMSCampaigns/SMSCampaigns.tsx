'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MessageSquare, Loader2, Users, X, Coins } from 'lucide-react';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { MessageCard } from './MessageCard';
import { SMSMessage, PhoneNumber } from './types';
import { supabase } from '@/utils/supabaseClient'

interface PreviewClient {
  client_id: string;
  first_name: string | null;
  last_name: string | null;
  phone_normalized: string;
  visiting_type: string | null;
  avg_weekly_visits: number | null;
  last_appt: string | null;
  total_appointments: number;
  days_since_last_visit: number;
  days_overdue: number;
  expected_visit_interval_days: number;
  score: number;
  date_last_sms_sent: string | null;
}

interface PreviewStats {
  total_selected: number;
  breakdown: Record<string, number>;
  avg_score: string;
  avg_days_overdue: string;
  avg_days_since_last_visit: string;
}

// Main component
export default function SMSCampaigns() {
  const [messages, setMessages] = useState<SMSMessage[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [savingMode, setSavingMode] = useState<'draft' | 'activate' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState<string>('');
  const [originalMessages, setOriginalMessages] = useState<Record<string, SMSMessage>>({});
  
  // Preview modal state
  const [showPreview, setShowPreview] = useState(false);
  const [previewClients, setPreviewClients] = useState<PreviewClient[]>([]);
  const [previewStats, setPreviewStats] = useState<PreviewStats | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [phoneNumbersByType, setPhoneNumbersByType] = useState<Record<string, PhoneNumber[]>>({});
  const [previewCounts, setPreviewCounts] = useState<Record<string, number>>({});

  const [activePreviewMessageId, setActivePreviewMessageId] = useState<string | null>(null);
  const [availableCredits, setAvailableCredits] = useState<number>(0); 

  const [algorithmType, setAlgorithmType] = useState<'campaign' | 'mass'>('campaign');
  const [maxClients, setMaxClients] = useState<number>(0);

  // Load existing messages on mount
  useEffect(() => {
    loadMessages();
    fetchCredits();
  }, []);

  // Load preview counts for all messages
  useEffect(() => {
    messages.forEach(msg => {
      if (msg.clientLimit) {
        loadMessagePreview(msg.id, msg.clientLimit);
      }
    });
  }, [messages.length]);

  useEffect(() => {
    // Only reload if there are scheduled messages
    if (messages.length > 0) {
      messages.forEach(message => {
        loadMessagePreview(message.id, message.clientLimit);
      });
    }
  }, [algorithmType]);

  const fetchCredits = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('available_credits')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setAvailableCredits(profile.available_credits || 0);
      }
    } catch (error) {
      console.error('Failed to fetch credits:', error);
    }
  };

  const loadMessages = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/client-messaging/save-sms-schedule?purpose=campaign&purpose=mass', {
        method: 'GET',
      });

      if (!response.ok) throw new Error('Failed to load messages');

      const data = await response.json();
      
      if (data.success && data.messages) {
        const loadedMessages = data.messages.map((dbMsg: any) => {
          // Parse the ISO timestamp directly
          const scheduleDateTime = new Date(dbMsg.cron);
          const scheduleDate = scheduleDateTime.toISOString().split('T')[0];
          
          // Get local time components
          const hour24 = scheduleDateTime.getHours();
          const minute = scheduleDateTime.getMinutes();
          
          // Convert to 12hr format
          let hour12: number;
          let period: 'AM' | 'PM';
          
          if (hour24 === 0) {
            hour12 = 12;
            period = 'AM';
          } else if (hour24 < 12) {
            hour12 = hour24;
            period = 'AM';
          } else if (hour24 === 12) {
            hour12 = 12;
            period = 'PM';
          } else {
            hour12 = hour24 - 12;
            period = 'PM';
          }

          const isValidated = dbMsg.status !== 'DENIED';

          const message = {
            id: dbMsg.id,
            title: dbMsg.title,
            message: dbMsg.message,
            scheduleDate,
            hour: hour12,
            minute,
            period,
            clientLimit: dbMsg.message_limit || 100,
            enabled: true,
            isSaved: true,
            isValidated: isValidated, 
            validationStatus: dbMsg.status,
            validationReason: undefined,
            isEditing: false,
          };
          
          return message;
        });

        setMessages(loadedMessages);
      }
    } catch (error) {
      console.error('❌ Failed to load messages:', error);
      toast.error('Failed to load existing messages');
    } finally {
      setIsLoading(false);
    }
  };

  const loadClientPreview = async (messageId: string, limit: number) => {
      setLoadingPreview(true);
      setActivePreviewMessageId(messageId);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id || '';
        const response = await fetch(`/api/client-messaging/preview-recipients?limit=${limit}&userId=${userId}&algorithm=${algorithmType}`);
        
        if (!response.ok) {
          throw new Error('Failed to load preview');
        }
        
        const data = await response.json();
        
        if (data.success) {
          const sortedClients = [...data.clients].sort((a, b) => 
            b.score - a.score
          );
          
          console.log(sortedClients.length);
          setMaxClients(data.maxClient || 0);
          setPreviewCounts(prev => ({ ...prev, [messageId]: sortedClients.length }));
          setPreviewClients(sortedClients);
          setPreviewStats(data.stats);
          setShowPreview(true);
        } else {
          toast.error(data.message || 'Failed to load preview');
        }
      } catch (error) {
        console.error('❌ Failed to load preview:', error);
        toast.error('Failed to load client preview');
      } finally {
        setLoadingPreview(false);
      }
  };

  const loadMessagePreview = async (messageId: string, limit: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || '';
      const response = await fetch(`/api/client-messaging/preview-recipients?limit=${limit}&userId=${userId}&algorithm=${algorithmType}`);
      
      if (!response.ok) {
        throw new Error('Failed to load preview');
      }
      
      const data = await response.json();
      
      if (data.success && data.stats) {
        setPreviewCounts(prev => ({ ...prev, [messageId]: data.clients.length }));
      }
    } catch (error) {
      console.error('Failed to load message preview:', error);
    }
  };

  const addMessage = () => {
      if (messages.length >= 3) {
        toast.error('Maximum of 3 scheduled messages allowed');
        return;
      }

      const hasDraft = messages.some((msg) => !msg.isSaved);
      if (hasDraft) {
        toast.error('Please save or delete your current draft before creating a new message');
        return;
      }

      const today = new Date().toISOString().split('T')[0];

      const newMessage: SMSMessage = {
        id: uuidv4(),
        title: `Message ${messages.length + 1}`,
        message: '',
        scheduleDate: today,
        hour: 10,
        minute: 0,
        period: 'AM',
        clientLimit: 100,
        enabled: true,
        isSaved: false,
        isValidated: false,
        validationStatus: 'DRAFT',
        validationReason: undefined,
        isEditing: true,
        purpose: algorithmType,
      };

      setMessages([...messages, newMessage]);
  };

  const removeMessage = async (id: string) => {
    const msg = messages.find((m) => m.id === id);
    
    const confirmed = window.confirm(
      `Are you sure you want to delete "${msg?.title || 'this message'}"?\n\nThis action is irreversible and will permanently remove the scheduled message.`
    );
    
    if (!confirmed) {
      return;
    }

    if (msg?.isSaved) {
      try {
        const response = await fetch('/api/client-messaging/save-sms-schedule', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });

        if (!response.ok) throw new Error('Failed to delete message');
        
        toast.success('Message deleted successfully');
      } catch (error) {
        console.error('Delete error:', error);
        toast.error('Failed to delete message');
        return;
      }
    }
    
    setMessages(messages.filter((msg) => msg.id !== id));
  };

  const updateMessage = (id: string, updates: Partial<SMSMessage>) => {
      setMessages(
        messages.map((msg) => {
          if (msg.id === id) {
            const updated = { ...msg, ...updates };
            
            if (updates.message !== undefined && updates.message !== msg.message) {
              updated.isValidated = false;
              updated.validationStatus = 'DRAFT';
              updated.validationReason = undefined;
            }
            
            if (updates.clientLimit !== undefined && updates.clientLimit !== msg.clientLimit) {
              loadMessagePreview(id, updates.clientLimit);
            }
            
            return updated;
          }
          return msg;
        })
      );
  };

  const enableEditMode = async (id: string) => {
    const msg = messages.find((m) => m.id === id);
    if (msg) {
      if (msg.validationStatus === 'ACCEPTED' && previewCounts[id]) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          // Get current credits
          const { data: profile } = await supabase
            .from('profiles')
            .select('available_credits, reserved_credits')
            .eq('user_id', user.id)
            .single();

          if (!profile) return;

          // Refund: move from reserved back to available
          const refundAmount = Math.min(previewCounts[id], profile.reserved_credits || 0);
          
          const { error } = await supabase
            .from('profiles')
            .update({
              available_credits: (profile.available_credits || 0) + refundAmount,
              reserved_credits: Math.max(0, (profile.reserved_credits || 0) - refundAmount),
              updated_at: new Date().toISOString()
            })
            .eq('user_id', user.id);

          if (error) {
            console.error('Failed to refund credits:', error);
            toast.error('Failed to refund credits');
            return;
          }

          // Update local state
          setAvailableCredits(prev => prev + refundAmount);
          toast.success(`${refundAmount} credits refunded - message set to draft`);

        } catch (error) {
          console.error('Failed to refund credits:', error);
          toast.error('Failed to refund credits');
          return;
        }
      }

      // Store original for cancel
      setOriginalMessages({
        ...originalMessages,
        [id]: { ...msg },
      });

      // Set to editing and change status to DRAFT
      updateMessage(id, { 
        isEditing: true,
        validationStatus: 'DRAFT'
      });
    }
  };

  const cancelEdit = async (id: string) => {
    const original = originalMessages[id];
    if (original) {
      setMessages(messages.map((msg) => (msg.id === id ? { ...original, isEditing: false } : msg)));
      const newOriginals = { ...originalMessages };
      delete newOriginals[id];
      setOriginalMessages(newOriginals);
    }
  };

  const handleSave = async (msgId: string, mode: 'draft' | 'activate') => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;

    console.log('💾 SAVE ATTEMPT:', {
      msgId,
      mode,
      messageLength: msg.message?.length,
      isValidated: msg.isValidated,
      validationStatus: msg.validationStatus,
      hour: msg.hour,
      minute: msg.minute,
      period: msg.period,
      scheduleDate: msg.scheduleDate
    });

    if (!msg.message.trim()) {
      toast.error('Please fill in message content');
      return;
    }
    if (msg.message.length < 100) {
      toast.error('Message must be at least 100 characters');
      return;
    }
    if (mode === 'activate' && !msg.isValidated) {
      toast.error('Message must be validated and approved before activating');
      return;
    }

    // Check credits before activation
    if (mode === 'activate') {
      const requiredCredits = previewCounts[msgId] || 0;
      
      if (requiredCredits === 0) {
        toast.error('Please preview recipients before activating');
        return;
      }
      
      if (availableCredits < requiredCredits) {
        toast.error(`Insufficient credits. You need ${requiredCredits} but only have ${availableCredits} available.`);
        return;
      }
    }

    // If saving as draft and message was previously activated, refund credits
    if (mode === 'draft' && msg.validationStatus === 'ACCEPTED' && previewCounts[msgId]) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('available_credits, reserved_credits')
            .eq('user_id', user.id)
            .single();

          if (profile) {
            const refundAmount = Math.min(previewCounts[msgId], profile.reserved_credits || 0);
            
            await supabase
              .from('profiles')
              .update({
                available_credits: (profile.available_credits || 0) + refundAmount,
                reserved_credits: Math.max(0, (profile.reserved_credits || 0) - refundAmount),
                updated_at: new Date().toISOString()
              })
              .eq('user_id', user.id);

            setAvailableCredits(prev => prev + refundAmount);
            console.log(`✅ Refunded ${refundAmount} credits when saving as draft`);
          }
        }
      } catch (error) {
        console.error('Failed to refund credits:', error);
      }
    }

    setIsSaving(true);
    setSavingMode(mode);
    
    try {
      // Convert 12hr to 24hr format
      let hour24 = msg.hour || 10;
      if (msg.period === 'PM' && msg.hour !== 12) {
        hour24 = msg.hour + 12;
      } else if (msg.period === 'AM' && msg.hour === 12) {
        hour24 = 0;
      }

      // Create ISO timestamp in user's local timezone
      const scheduleDateTime = new Date(msg.scheduleDate + 'T00:00:00');
      scheduleDateTime.setHours(hour24, msg.minute || 0, 0, 0);
      const scheduledFor = scheduleDateTime.toISOString();

      console.log('📅 SCHEDULE CREATION:', {
        userSelected: `${msg.scheduleDate} ${msg.hour}:${msg.minute} ${msg.period}`,
        hour24,
        scheduledFor,
        localTime: scheduleDateTime.toString()
      });

      const messageToSave = {
        id: msg.id,
        title: msg.title,
        message: msg.message,
        scheduleDate: msg.scheduleDate,
        clientLimit: msg.clientLimit,
        hour: msg.hour || 10,
        minute: msg.minute || 0,
        period: msg.period || 'AM',
        scheduledFor, // ISO timestamp
        validationStatus: mode === 'draft' ? 'DRAFT' : 'ACCEPTED',
        isValidated: msg.isValidated,
        purpose: algorithmType,
        previewCount: mode === 'activate' ? previewCounts[msgId] : undefined,
      };

      console.log('📤 SENDING TO API:', messageToSave);

      const response = await fetch('/api/client-messaging/save-sms-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [messageToSave] }),
      });

      console.log('📥 API RESPONSE STATUS:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ API ERROR RESPONSE:', errorData);
        throw new Error(errorData.error || 'Failed to save schedule');
      }

      const data = await response.json();
      console.log('✅ API SUCCESS RESPONSE:', data);

      if (data.success) {
        // Only deduct credits on activation (not when saving as draft)
        if (mode === 'activate' && previewCounts[msgId]) {
          setAvailableCredits(prev => prev - previewCounts[msgId]);
        }
        
        setMessages(messages.map(m =>
          m.id === msgId
            ? { 
                ...m, 
                isSaved: true, 
                isEditing: false, 
                validationStatus: mode === 'draft' ? 'DRAFT' : 'ACCEPTED',
                isValidated: mode === 'activate' ? true : m.isValidated
              }
            : m
        ));
        toast.success(mode === 'draft' ? 'Draft saved!' : 'Schedule activated!');
      } else {
        console.error('❌ SAVE FAILED:', data);
        toast.error(data.error || 'Failed to save the campaign schedule');
      }
    } catch (err: any) {
      console.error('❌ SAVE ERROR:', err);
      toast.error(err.message || 'Failed to save SMS schedule');
    } finally {
      setIsSaving(false);
      setSavingMode(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-sky-300 animate-spin mx-auto mb-4" />
          <p className="text-[#bdbdbd]">Loading your messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-sky-300" />
              SMS Marketing Manager
            </h2>
            <p className="text-[#bdbdbd] text-sm">
              Schedule up to 3 automated marketing messages to keep your clients engaged
            </p>
            {/* NEW: Credits display */}
            <div className="mt-3 flex items-center gap-2">
              <div className="px-3 py-1.5 bg-lime-300/10 border border-lime-300/20 rounded-full flex items-center gap-2">
                <Coins className="w-4 h-4 text-lime-300" />
                <span className="text-sm font-semibold text-lime-300">
                  {availableCredits.toLocaleString()} credits available
                </span>
              </div>
              <span className="text-xs text-[#bdbdbd]">
                1 credit = 1 SMS message
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {messages.length < 3 && (
              <button
                onClick={addMessage}
                className="flex items-center gap-2 px-4 py-2 bg-sky-300 text-black rounded-full font-semibold text-sm hover:bg-sky-400 transition-all duration-300 shadow-[0_0_12px_rgba(125,211,252,0.4)] hover:shadow-[0_0_16px_rgba(125,211,252,0.6)]"
              >
                <Plus className="w-4 h-4" />
                Create Message
              </button>
            )}
          </div>
        </div>

        {/* Usage indicator */}
        <div className="flex items-center gap-2 text-xs text-[#bdbdbd]">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`w-16 h-1 rounded-full transition-all duration-300 ${
                  i < messages.length
                    ? 'bg-sky-300 shadow-[0_0_4px_rgba(125,211,252,0.6)]'
                    : 'bg-white/10'
                }`}
              />
            ))}
          </div>
          <span>
            {messages.length} / 3 messages scheduled
          </span>
        </div>
      </div>

      {/* Client Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowPreview(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-sky-300" />
                    Recipients for {messages.find(m => m.id === activePreviewMessageId)?.title || 'Message'}
                  </h3>
                  {previewStats && (
                    <p className="text-sm text-[#bdbdbd] mt-1">
                      {previewStats.total_selected} clients will receive this message. Your maximum clients based on the algorithm is {maxClients}. 
                    </p>
                  )}
                </div>

                <button
                  onClick={() => setShowPreview(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-[#bdbdbd]" />
                </button>
              </div>

              

              {/* Stats */}
              {previewStats && (
                <div className="p-6 border-b border-white/10 bg-white/5">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                      <p className="text-xs text-[#bdbdbd] mb-1">Total Selected</p>
                      <p className="text-2xl font-bold text-white">{previewStats.total_selected}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#bdbdbd] mb-1">Avg Score</p>
                      <p className="text-2xl font-bold text-sky-300">{previewStats.avg_score}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#bdbdbd] mb-1">Avg Days Since Visit</p>
                      <p className="text-2xl font-bold text-purple-400">{previewStats.avg_days_since_last_visit}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#bdbdbd] mb-1">Avg Days Overdue</p>
                      <p className="text-2xl font-bold text-orange-400">{previewStats.avg_days_overdue}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#bdbdbd] mb-1">Breakdown</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(previewStats.breakdown).map(([type, count]) => (
                          <span key={type} className="text-xs px-2 py-1 bg-white/10 rounded-full text-white">
                            {type}: {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Clients List */}
              <div className="overflow-y-auto max-h-[50vh] p-6">
                <div className="space-y-2">
                  {previewClients.map((client) => (
                    <div
                      key={client.client_id}
                      className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h4 className="font-semibold text-white">
                            {client.first_name} {client.last_name}
                          </h4>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            client.visiting_type === 'consistent' ? 'bg-green-500/20 text-green-400' :
                            client.visiting_type === 'semi-consistent' ? 'bg-blue-500/20 text-blue-400' :
                            client.visiting_type === 'easy-going' ? 'bg-yellow-500/20 text-yellow-400' :
                            client.visiting_type === 'rare' ? 'bg-red-500/20 text-red-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {client.visiting_type}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-[#bdbdbd]">
                          <span>{client.phone_normalized}</span>
                          <span>•</span>
                          <span>{client.days_since_last_visit} days since last visit</span>
                          <span>•</span>
                          <span className="text-orange-400">{client.days_overdue} days overdue</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-sky-300">Score: {client.score}</p>
                        <p className="text-xs text-[#bdbdbd]">{client.avg_weekly_visits?.toFixed(2)}/week</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages List */}
      <AnimatePresence mode="popLayout">
        {messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl p-12 text-center"
          >
            <div className="w-20 h-20 bg-sky-300/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-10 h-10 text-sky-300" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              No messages scheduled
            </h3>
            <p className="text-[#bdbdbd] mb-6 max-w-md mx-auto">
              Create your first automated SMS message to stay connected with your clients
            </p>
            <button
              onClick={addMessage}
              className="inline-flex items-center gap-2 px-6 py-3 bg-sky-300 text-black rounded-full font-semibold hover:bg-sky-400 transition-all duration-300 shadow-[0_0_12px_rgba(125,211,252,0.4)] hover:shadow-[0_0_16px_rgba(125,211,252,0.6)]"
            >
              <Plus className="w-5 h-5" />
              Create Message
            </button>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, index) => (
              <MessageCard
                setAlgorithmType={setAlgorithmType}
                availableCredits={availableCredits}
                key={msg.id}
                message={msg}
                index={index}
                isSaving={isSaving}
                savingMode={savingMode}
                validatingId={validatingId}
                editingTitleId={editingTitleId}
                tempTitle={tempTitle}
                previewCount={previewCounts[msg.id] || 0}
                loadingPreview={loadingPreview}
                onLoadPreview={(limit) => loadClientPreview(msg.id, limit)} 
                onUpdate={updateMessage}
                onRemove={removeMessage}
                onEnableEdit={enableEditMode}
                onCancelEdit={cancelEdit}
                onSave={handleSave}
                onValidate={async (msgId: string) => {
                  const msg = messages.find((m) => m.id === msgId);
                  if (!msg || !msg.message.trim()) {
                    toast.error('Please enter a message first');
                    return;
                  }

                  if (msg.message.length < 100) {
                    toast.error('Message must be at least 100 characters');
                    return;
                  }

                  setValidatingId(msgId);
                  try {
                    const response = await fetch('/api/client-messaging/verify-message', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ message: msg.message }),
                    });

                    const data = await response.json();

                    if (!response.ok) {
                      throw new Error(data.error || 'Validation failed');
                    }

                    updateMessage(msgId, {
                      isValidated: data.approved,
                      validationStatus: data.approved ? 'DRAFT' : 'DENIED',
                      validationReason: data.approved ? undefined : data.reason,
                    });

                    if (data.approved) {
                      toast.success('Message validated and approved! You can now save as draft or activate.');
                    } else {
                      toast.error(data.reason || 'Message was denied');
                    }
                  } catch (error: any) {
                    console.error('Validation error:', error);
                    toast.error(error.message || 'Failed to validate message');
                  } finally {
                    setValidatingId(null);
                  }
                }}
                onStartEditingTitle={(id: string, currentTitle: string) => {
                  setEditingTitleId(id);
                  setTempTitle(currentTitle);
                }}
                onSaveTitle={(id: string) => {
                  if (tempTitle.trim()) {
                    updateMessage(id, { title: tempTitle.trim() });
                  }
                  setEditingTitleId(null);
                  setTempTitle('');
                }}
                onCancelEditTitle={() => {
                  setEditingTitleId(null);
                  setTempTitle('');
                }}
                onTempTitleChange={setTempTitle}
              />
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}