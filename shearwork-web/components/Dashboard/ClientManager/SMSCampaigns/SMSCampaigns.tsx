'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MessageSquare, Loader2, Coins, Send, Info, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { MessageCard } from './MessageCard';
import { SMSMessage, PhoneNumber } from './types';
import { supabase } from '@/utils/supabaseClient';

import HowCampaignsWorkModal from './Modals/HowCampaignsWorkModal';
import CampaignHistoryModal from './Modals/CampaignHistoryModal';
import TestMessageConfirmModal from './Modals/TestMessageConfirmModal';
import RecipientPreviewModal from './Modals/RecipientPreviewModal';
import DeleteMessageConfirmModal from './Modals/DeleteMessageConfirmModal';

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
  const [deselectedPreviewClients, setDeselectedPreviewClients] = useState<PreviewClient[]>([]);
  const [previewStats, setPreviewStats] = useState<PreviewStats | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewCounts, setPreviewCounts] = useState<Record<string, number>>({});

  // Modal states
  const [showHowCampaignsWorkModal, setShowHowCampaignsWorkModal] = useState(false);
  const [showCampaignHistoryModal, setShowCampaignHistoryModal] = useState(false);
  const [showTestConfirmModal, setShowTestConfirmModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Preview clients modal
  const [activePreviewMessageId, setActivePreviewMessageId] = useState<string | null>(null);
  const [availableCredits, setAvailableCredits] = useState<number>(0); 

  // Delete confirmation modal
  const [pendingDeleteMessageId, setPendingDeleteMessageId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<'soft' | 'hard'>('hard');

  const [algorithmType, setAlgorithmType] = useState<'campaign' | 'mass' | 'auto-nudge'>('auto-nudge');
  const [maxClients, setMaxClients] = useState<number>(0);

  const [profile, setProfile] = useState<any>(null);

  const [testMessagesUsed, setTestMessagesUsed] = useState<number>(0);
  const [pendingTestMessageId, setPendingTestMessageId] = useState<string | null>(null);

  const [previewModalKey, setPreviewModalKey] = useState(0);

  const [previewLimit, setPreviewLimit] = useState(250);

  const [totalUnselectedClients, setTotalUnselectedClients] = useState(0);

  // Progress tracking state
  const [campaignProgress, setCampaignProgress] = useState<Record<string, {
    success: number;
    fail: number;
    total: number;
    expected: number;
    percentage: number;
    is_finished: boolean;
    is_active: boolean;
  }>>({});

  // Load existing messages on mount
  useEffect(() => {
    loadMessages();
    fetchCredits();
    fetchTestMessageCount();
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

  // Poll for campaign progress every 3 seconds if there are active campaigns
  useEffect(() => {
    const hasActiveCampaigns = messages.some(msg => {
      const progress = campaignProgress[msg.id];
      return progress?.is_active || (msg.validationStatus === 'ACCEPTED' && !progress?.is_finished);
    });

    if (!hasActiveCampaigns) return;

    const pollProgress = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const messageIds = messages.map(m => m.id).join(',');
        const response = await fetch(`/api/client-messaging/get-campaign-progress?userId=${user.id}&messageIds=${messageIds}`);
        
        if (!response.ok) return;

        const data = await response.json();
        
        if (data.success && data.progress) {
          const progressMap: typeof campaignProgress = {};
          data.progress.forEach((p: any) => {
            progressMap[p.id] = p;
          });
          setCampaignProgress(progressMap);
        }
      } catch (error) {
        console.error('Failed to fetch campaign progress:', error);
      }
    };

    // Poll immediately, then every 3 seconds
    pollProgress();
    const interval = setInterval(pollProgress, 3000);

    return () => clearInterval(interval);
  }, [messages, campaignProgress]);

  const fetchTestMessageCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get start of today in user's timezone
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('sms_sent')
        .select('id')
        .eq('user_id', user.id)
        .eq('purpose', 'test_message')
        .eq('is_sent', true)
        .gte('created_at', today.toISOString());

      if (error) {
        console.error('Failed to fetch test message count:', error);
        return;
      }

      setTestMessagesUsed(data?.length || 0);
    } catch (error) {
      console.error('Failed to fetch test message count:', error);
    }
  };

  const fetchCredits = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email, phone, available_credits')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setAvailableCredits(profile.available_credits || 0);
        setProfile(profile);
      }
    } catch (error) {
      console.error('Failed to fetch credits:', error);
    }
  };

  const loadMessages = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/client-messaging/save-sms-schedule?purpose=campaign&purpose=mass&excludeDeleted=true', {
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
            algorithm: dbMsg.purpose,
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

      let response;
      if (algorithmType === 'auto-nudge') {
        const { data: messageData } = await supabase
          .from('sms_scheduled_messages')
          .select('purpose, title')
          .eq('id', messageId)
          .single();

        response = await fetch(`/api/client-messaging/preview-recipients?limit=${limit}&userId=${userId}&algorithm=${messageData?.purpose}&messageId=${messageId}`);
      } else {
        response = await fetch(`/api/client-messaging/preview-recipients?limit=${limit}&userId=${userId}&algorithm=${algorithmType}&messageId=${messageId}`);
      }

      if (!response.ok) {
        throw new Error('Failed to load preview');
      }
      
      const data = await response.json();
      
      if (data.success) {
        const clients = data.clients;
        setMaxClients(data.maxClient || 0);
        setPreviewCounts(prev => ({ ...prev, [messageId]: clients.length }));
        setPreviewClients(clients);
        setDeselectedPreviewClients(data.deselectedClients || []);
        setTotalUnselectedClients(data.deselectedClients?.length || 0); 
        setPreviewStats(data.stats);
        setShowPreview(true);
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

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowString = tomorrow.toISOString().split('T')[0];

      const newMessage: SMSMessage = {
        id: uuidv4(),
        title: `Message ${messages.length + 1}`,
        message: '',
        scheduleDate: tomorrowString,
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
    if (!msg) return;

    // Check if campaign is finished
    const progress = campaignProgress[id];
    const isFinished = progress?.is_finished;

    // Set delete type and show modal
    setDeleteType(isFinished ? 'soft' : 'hard');
    setPendingDeleteMessageId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteMessageId) return;

    const msg = messages.find((m) => m.id === pendingDeleteMessageId);
    
    if (msg?.isSaved) {
      try {
        const response = await fetch('/api/client-messaging/save-sms-schedule', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            id: pendingDeleteMessageId,
            softDelete: deleteType === 'soft'
          }),
        });

        if (!response.ok) throw new Error('Failed to delete message');
        
        toast.success('Message deleted successfully');
      } catch (error) {
        console.error('Delete error:', error);
        toast.error('Failed to delete message');
        setShowDeleteModal(false);
        setPendingDeleteMessageId(null);
        return;
      }
    }
    
    setMessages(messages.filter((msg) => msg.id !== pendingDeleteMessageId));
    setShowDeleteModal(false);
    setPendingDeleteMessageId(null);
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

          const oldAvailable = profile.available_credits || 0;
          const newAvailable = oldAvailable + refundAmount;
          const oldReserved = profile.reserved_credits || 0;
          const newReserved = Math.max(0, oldReserved - refundAmount);
          
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

          await supabase
          .from('credit_transactions')
          .insert({
            user_id: user.id,
            action: `Campaign deactivated - ${msg.title}`,
            old_available: oldAvailable,
            new_available: newAvailable,
            old_reserved: oldReserved,
            new_reserved: newReserved,
            reference_id: msg.id, 
            created_at: new Date().toISOString()
          });

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
            
            const oldAvailable = profile.available_credits || 0;
            const newAvailable = oldAvailable + refundAmount;
            const oldReserved = profile.reserved_credits || 0;
            const newReserved = Math.max(0, oldReserved - refundAmount);
            
            await supabase
              .from('profiles')
              .update({
                available_credits: newAvailable,
                reserved_credits: newReserved,
                updated_at: new Date().toISOString()
              })
              .eq('user_id', user.id);

            setAvailableCredits(newAvailable);
            
            // Log credit transaction
            await supabase
              .from('credit_transactions')
              .insert({
                user_id: user.id,
                action: `Campaign saved as draft - ${msg.title}`,
                old_available: oldAvailable,
                new_available: newAvailable,
                old_reserved: oldReserved,
                new_reserved: newReserved,
                reference_id: msg.id, 
                created_at: new Date().toISOString()
              });
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

      const response = await fetch('/api/client-messaging/save-sms-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [messageToSave] }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ API ERROR RESPONSE:', errorData);
        throw new Error(errorData.error || 'Failed to save schedule');
      }

      const data = await response.json();

      if (data.success) {
        // Only deduct credits on activation (not when saving as draft)
        if (mode === 'activate' && previewCounts[msgId]) {
          const oldAvailable = availableCredits;
          const newAvailable = availableCredits - previewCounts[msgId];
          setAvailableCredits(newAvailable);
          
          // Log credit transaction
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('reserved_credits')
              .eq('user_id', user.id)
              .single();
            
            const newReserved = profile?.reserved_credits || 0;
            const oldReserved = newReserved - previewCounts[msgId];

            await supabase
              .from('credit_transactions')
              .insert({
                user_id: user.id,
                action: `Campaign activated - ${msg.title}`,
                old_available: oldAvailable,
                new_available: newAvailable,
                old_reserved: oldReserved,
                new_reserved: newReserved,
                reference_id: msg.id, 
                created_at: new Date().toISOString()
              });
          }
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

  const handleTestMessageSend = async (msgId: string) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;

    try {
      const response = await fetch(`/api/client-messaging/qstash-sms-send?messageId=${msg.id}&action=test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send test message');
      }

      setTestMessagesUsed(testMessagesUsed + 1);

      // If this is a paid test (over 10 free tests), log transaction
      if (testMessagesUsed >= 10) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('available_credits, reserved_credits')
            .eq('user_id', user.id)
            .single();
          
          if (profile) {
            const oldAvailable = profile.available_credits || 0;
            const newAvailable = oldAvailable - 1;
            const oldReserved = profile.reserved_credits || 0;
            const newReserved = oldReserved; // No change to reserved for test messages
            
            await supabase
              .from('credit_transactions')
              .insert({
                user_id: user.id,
                action: `Paid test message - ${msg.title}`,
                old_available: oldAvailable,
                new_available: newAvailable,
                old_reserved: oldReserved,
                new_reserved: newReserved,
                reference_id: msg.id, 
                created_at: new Date().toISOString()
              });
          }
        }
      }

      toast.success('Test message sent successfully to your phone!');
      fetchTestMessageCount(); // Refresh test count
    } catch (error: any) {
      console.error('Test message error:', error);
      toast.error(error.message || 'Failed to send test message');
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
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl sm:rounded-2xl shadow-xl p-3 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between mb-3 sm:mb-4 gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-2xl font-bold text-white mb-2 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 sm:w-6 sm:h-6 text-sky-300" />
              SMS Campaign Manager
            </h2>

            <div className="grid grid-cols-2 lg:flex lg:flex-wrap items-center gap-1.5 sm:gap-2 mt-2 sm:mt-3">
              <button
                onClick={() => setShowCampaignHistoryModal(true)}
                className="inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-purple-300/10 border border-purple-300/30 text-purple-300 rounded-lg font-semibold text-[10px] sm:text-sm hover:bg-purple-300/20 hover:border-purple-300/40 transition-all duration-300"
              >
                <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">Campaign History</span>
                <span className="xs:hidden">History</span>
              </button>

              <button
                onClick={() => setShowHowCampaignsWorkModal(true)}
                className="inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-sky-300/10 border border-sky-300/30 text-sky-300 rounded-lg font-semibold text-[10px] sm:text-sm hover:bg-sky-300/20 hover:border-sky-300/40 transition-all duration-300"
              >
                <Info className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">How does this work?</span>
                <span className="xs:hidden">How it works</span>
              </button>
            </div>
            
            <p className="text-[#bdbdbd] text-xs sm:text-sm mt-2 sm:mt-3 hidden sm:block">
              Schedule targeted SMS campaigns to stay connected with your clients
            </p>
          </div>
          
          <div className="flex flex-col items-stretch lg:items-end gap-2 sm:gap-3">
            {/* Credits, Tests, and Create Button - All responsive */}
            <div className="grid grid-cols-4 lg:grid-cols-2 gap-1.5 sm:gap-2">
              <div className="px-2 py-1.5 sm:px-3 sm:py-1.5 bg-lime-300/10 border border-lime-300/20 rounded-full flex items-center justify-center gap-1 sm:gap-2 lg:col-span-1">
                <Coins className="w-3 h-3 sm:w-4 sm:h-4 text-lime-300 flex-shrink-0" />
                <span className="text-[10px] sm:text-sm font-semibold text-lime-300 truncate">
                  <span className="hidden sm:inline">{availableCredits.toLocaleString()} credits available</span>
                  <span className="sm:hidden">{availableCredits > 999 ? `${(availableCredits / 1000).toFixed(1)}k` : availableCredits}</span>
                </span>
              </div>
              
              <div className={`px-2 py-1.5 sm:px-3 sm:py-1.5 rounded-full flex items-center justify-center gap-1 sm:gap-2 lg:col-span-1 ${
                testMessagesUsed >= 10 
                  ? 'bg-rose-300/10 border border-rose-300/20'
                  : 'bg-sky-300/10 border border-sky-300/20'
              }`}>
                <Send className={`w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 ${testMessagesUsed >= 10 ? 'text-rose-300' : 'text-sky-300'}`} />
                <span className={`text-[10px] sm:text-sm font-semibold truncate ${testMessagesUsed >= 10 ? 'text-rose-300' : 'text-sky-300'}`}>
                  <span className="hidden sm:inline">{10 - testMessagesUsed} free tests left today</span>
                  <span className="sm:hidden">{10 - testMessagesUsed}</span>
                </span>
              </div>

              {/* Create Message Button - Only show if under limit */}
              {messages.length < 3 && (
                <button
                  onClick={addMessage}
                  className="col-span-2 flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-sky-300 text-black rounded-full font-semibold text-[10px] sm:text-sm hover:bg-sky-400 transition-all duration-300 shadow-[0_0_12px_rgba(125,211,252,0.4)] hover:shadow-[0_0_16px_rgba(125,211,252,0.6)]"
                >
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Create Message</span>
                  <span className="sm:hidden">Create</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Usage indicator */}
        <div className="flex items-center gap-2 text-[10px] sm:text-xs text-[#bdbdbd]">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`w-12 sm:w-16 h-1 rounded-full transition-all duration-300 ${
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

      {/* Modals */}
      <HowCampaignsWorkModal 
        isOpen={showHowCampaignsWorkModal}
        onClose={() => setShowHowCampaignsWorkModal(false)}
      />

      <CampaignHistoryModal 
        isOpen={showCampaignHistoryModal}
        onClose={() => setShowCampaignHistoryModal(false)}
      />

      <TestMessageConfirmModal
        isOpen={showTestConfirmModal}
        onClose={() => {
          setShowTestConfirmModal(false);
          setPendingTestMessageId(null);
        }}
        onConfirm={async () => {
          if (pendingTestMessageId) {
            setShowTestConfirmModal(false);
            await handleTestMessageSend(pendingTestMessageId);
            setPendingTestMessageId(null);
          }
        }}
        testMessagesUsed={testMessagesUsed}
        availableCredits={availableCredits}
        profilePhone={profile?.phone || null}
      />

      <RecipientPreviewModal
        key={previewModalKey}
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        onRefresh={async () => {
          setShowPreview(false);
          
          // Wait for modal to close
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // Reload the preview data with the correct limit
          if (activePreviewMessageId) {
            await loadClientPreview(activePreviewMessageId, previewLimit);
          }
          
          // Increment key and reopen
          setPreviewModalKey(prev => prev + 1);
          setShowPreview(true);
        }}
        messageTitle={messages.find(m => m.id === activePreviewMessageId)?.title || 'Message'}
        messageId={activePreviewMessageId}
        previewClients={previewClients}
        deselectedPreviewClients={deselectedPreviewClients}
        previewStats={previewStats}
        maxClients={maxClients}
        initialTotalUnselectedClients={totalUnselectedClients}
      />

      <DeleteMessageConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setPendingDeleteMessageId(null);
        }}
        onConfirm={confirmDelete}
        deleteType={deleteType}
      />

      {/* Messages List */}
      <AnimatePresence mode="popLayout">
        {messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl sm:rounded-2xl shadow-xl p-8 sm:p-12 text-center"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-sky-300/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-8 h-8 sm:w-10 sm:h-10 text-sky-300" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">
              No messages scheduled
            </h3>
            <p className="text-[#bdbdbd] text-sm sm:text-base mb-6 max-w-md mx-auto">
              Create your first automated SMS message to stay connected with your clients
            </p>
            <button
              onClick={addMessage}
              className="inline-flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-sky-300 text-black rounded-full font-semibold text-sm sm:text-base hover:bg-sky-400 transition-all duration-300 shadow-[0_0_12px_rgba(125,211,252,0.4)] hover:shadow-[0_0_16px_rgba(125,211,252,0.6)]"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              Create Message
            </button>
          </motion.div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {messages.map((msg, index) => (
              <MessageCard
                maxClients={maxClients}
                testMessagesUsed={testMessagesUsed}
                profile={profile}
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
                campaignProgress={campaignProgress[msg.id]}
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
                onRequestTest={(msgId) => { 
                  setPendingTestMessageId(msgId);
                  setShowTestConfirmModal(true);
                }}
                onTestComplete={() => fetchTestMessageCount()} 
              />
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}