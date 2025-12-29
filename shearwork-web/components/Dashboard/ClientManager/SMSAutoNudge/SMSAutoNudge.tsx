'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MessageSquare, Loader2, Users, X, Clock, Calendar, AlertCircle, Coins, Send, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { MessageCard } from './MessageCard';
import { SMSMessage, PhoneNumber } from './types';
import { supabase } from '@/utils/supabaseClient';
import TestMessageConfirmModal from './Modals/TestMessageConfirmModal';
import HowAutoNudgeWorksModal from './Modals/HowAutoNudgeWorksModal'
import AutoNudgeHistoryModal from './Modals/AutoNudgeHistoryModal'
import ClientPreviewModal from './Modals/ClientPreviewModal'

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
export default function SMSAutoNudge() {
  // #region UseStates are here
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
  
  // Schedule modal state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState<number>(1);
  const [scheduleHour, setScheduleHour] = useState<number>(10);
  const [scheduleMinute, setScheduleMinute] = useState<number>(0);
  const [schedulePeriod, setSchedulePeriod] = useState<'AM' | 'PM'>('AM');
  const [scheduleStartDate, setScheduleStartDate] = useState<string>('');
  const [scheduleEndDate, setScheduleEndDate] = useState<string>('');
  const [hasSchedule, setHasSchedule] = useState(false);
  const [isDraftingAll, setIsDraftingAll] = useState(false);

  // Credits and test messages
  const [availableCredits, setAvailableCredits] = useState<number>(0);
  const [testMessagesUsed, setTestMessagesUsed] = useState<number>(0);
  const [profile, setProfile] = useState<any>(null);
  
  // Test message modal
  const [showTestConfirmModal, setShowTestConfirmModal] = useState(false);
  const [pendingTestMessageId, setPendingTestMessageId] = useState<string | null>(null);

  // Auto Nudge modals
  const [showAutoNudgeHistoryModal, setShowAutoNudgeHistoryModal] = useState(false);
  const [showHowAutoNudgeWorksModal, setShowHowAutoNudgeWorksModal] = useState(false);

  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [pendingDeactivateMessageId, setPendingDeactivateMessageId] = useState<string | null>(null);

  const [isLoadingSchedule, setIsLoadingSchedule] = useState(true);

  const [lockedMessages, setLockedMessages] = useState<Set<string>>(new Set());
  const [checkingLocks, setCheckingLocks] = useState(true);

  const [autoNudgeCampaignProgress, setAutoNudgeCampaignProgress] = useState<Record<string, {
    is_finished: boolean;
    is_running: boolean;
  }>>({});

  // #endregion

  // Load existing messages on mount
  useEffect(() => {
    const initializeData = async () => {
      setIsLoading(true); // Keep loading
      await checkMessageLocks(); // Check locks FIRST
      await loadMessages();
      await loadClientPreview();
      await fetchCredits();
      await fetchTestMessageCount();
      setIsLoading(false); // Only after everything loads
    };
    
    initializeData();
  }, []);

  // Safety check - if messages is still empty after loading, create defaults
  useEffect(() => {
    if (!isLoading && messages.length === 0) {
      createDefaultMessages();
    }
  }, [isLoading, messages.length]);

  // loading schedule from db
  useEffect(() => {
    const loadSchedule = async () => {
      try {
        setIsLoadingSchedule(true);
        
        // Get user session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session?.user?.id) {
          console.log('❌ No session found');
          setIsLoadingSchedule(false);
          return;
        }

        // Fetch profile with auto_nudge_schedule
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('auto_nudge_schedule')
          .eq('user_id', session.user.id)
          .single();

        if (profileError || !profile?.auto_nudge_schedule) {
          console.log('⚠️ No schedule found in profile');
          setIsLoadingSchedule(false);
          return;
        }

        // Parse the schedule: "minute hour day * * | startdate | enddate"
        const parts = profile.auto_nudge_schedule.split(' | ');

        if (parts.length === 3) {
          const cronParts = parts[0].split(' ');
          const startDate = parts[1];
          const endDate = parts[2] === 'null' ? '' : parts[2];

          if (cronParts.length === 5) {
            const minute = parseInt(cronParts[0]);
            const hour24 = parseInt(cronParts[1]);
            const dayOfMonth = parseInt(cronParts[2]);

            // Convert 24-hour to 12-hour format
            let hour12 = hour24;
            let period: 'AM' | 'PM' = 'AM';
            
            if (hour24 === 0) {
              hour12 = 12;
              period = 'AM';
            } else if (hour24 === 12) {
              hour12 = 12;
              period = 'PM';
            } else if (hour24 > 12) {
              hour12 = hour24 - 12;
              period = 'PM';
            } else {
              hour12 = hour24;
              period = 'AM';
            }

            // Set all the schedule states
            setScheduleDayOfMonth(dayOfMonth);
            setScheduleHour(hour12);
            setScheduleMinute(minute);
            setSchedulePeriod(period);
            setScheduleStartDate(startDate);
            setScheduleEndDate(endDate);
            setHasSchedule(true);
          }
        }
      } catch (error) {
        console.error('Error loading schedule:', error);
      } finally {
        setIsLoadingSchedule(false);
      }
    };

  loadSchedule();
  }, []);

  const checkMessageLocks = async () => {
    setCheckingLocks(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all auto-nudge scheduled messages with their status
      const { data, error } = await supabase
        .from('sms_scheduled_messages')
        .select('id, is_finished, is_running')
        .eq('user_id', user.id)
        .eq('purpose', 'auto-nudge');

      if (error) {
        console.error('❌ Error fetching scheduled messages:', error);
        throw error;
      }

      // Create autoNudgeCampaignProgress map
      const progressMap: Record<string, { is_finished: boolean; is_running: boolean }> = {};
      const lockedIds = new Set<string>();

      data?.forEach(msg => {
        progressMap[msg.id] = {
          is_finished: msg.is_finished || false,
          is_running: msg.is_running || false
        };

        // If message is finished, it's locked
        if (msg.is_finished) {
          lockedIds.add(msg.id);
        }
      });

      setAutoNudgeCampaignProgress(progressMap);
      setLockedMessages(lockedIds);
    } catch (error) {
      console.error('❌ Failed to check message locks:', error);
    } finally {
      setCheckingLocks(false);
    }
  };

  const fetchCredits = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, email, phone, available_credits')
        .eq('user_id', user.id)
        .single();

      if (profileData) {
        setAvailableCredits(profileData.available_credits || 0);
        setProfile(profileData);
      }
    } catch (error) {
      console.error('Failed to fetch credits:', error);
    }
  };

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

  const loadMessages = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/client-messaging/save-sms-schedule?purpose=auto-nudge', {
        method: 'GET',
      });

      if (!response.ok) {
        console.log('❌ Response not OK, throwing error');
        throw new Error('Failed to load messages');
      }

      const data = await response.json();
      
      // Define all possible visiting types and their titles
      const visitingTypes: Array<'consistent' | 'semi-consistent' | 'easy-going' | 'rare' | 'new'> = [
        'consistent',
        'semi-consistent',
        'easy-going',
        'rare',
        'new'
      ];

      const titles = {
        'consistent': 'Consistent (Once every week)',
        'semi-consistent': 'Semi-Consistent (Once every 2-3 weeks)',
        'easy-going': 'Easy-Going (Once every 3-8 weeks)',
        'rare': 'Rare (Less than once every 2 months)',
        'new': 'New (Has only gone once)'
      };

      // Start with an empty array
      const allMessages: SMSMessage[] = [];
      
      // Track which visiting types we've loaded from the database
      const loadedTypes = new Set<string>();
      
      // First, process all saved messages from the database
      if (data.success && data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
        
        data.messages.forEach((dbMsg: any) => {
          // Parse cron to extract time
          const cronParts = dbMsg.cron.split(' ');
          const minute = parseInt(cronParts[0]);
          const hour24 = parseInt(cronParts[1]);
          const dayOfWeekCron = cronParts[4];
          
          // Convert 24hr to 12hr format
          let hour12 = hour24;
          let period: 'AM' | 'PM' = 'AM';
          
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

          // Get day of month
          const dayOfMonthCron = cronParts[2];
          const dayOfMonth = dayOfMonthCron !== '*' ? parseInt(dayOfMonthCron) : 1;

          const isValidated = dbMsg.status !== 'DENIED';

          const convertedMsg: SMSMessage = {
            id: dbMsg.id,
            title: dbMsg.title,
            message: dbMsg.message,
            visitingType: dbMsg.visiting_type || 'consistent',
            frequency: 'monthly',
            dayOfMonth,
            hour: hour12,
            minute,
            period,
            enabled: dbMsg.status === 'ACCEPTED',
            isSaved: true,
            isValidated: isValidated, 
            validationStatus: dbMsg.status,
            validationReason: undefined,
            isEditing: false,
          };
          
          // Add to messages array and track this type
          allMessages.push(convertedMsg);
          if (dbMsg.visiting_type) {
            loadedTypes.add(dbMsg.visiting_type);
          }
        });
      } else {
        console.log('⚠️ No saved messages found in database');
      }

      // Now create defaults for any missing types
      visitingTypes.forEach((type) => {
        if (!loadedTypes.has(type)) {
          allMessages.push({
            id: uuidv4(),
            title: titles[type],
            message: '',
            visitingType: type,
            frequency: 'monthly',
            dayOfMonth: 1,
            hour: 10,
            minute: 0,
            period: 'AM',
            enabled: false,
            isSaved: false,
            isValidated: false,
            validationStatus: 'DRAFT',
            validationReason: undefined,
            isEditing: true,
          });
        }
      });

      // Sort messages to maintain consistent order
      const typeOrder = { 'consistent': 0, 'semi-consistent': 1, 'easy-going': 2, 'rare': 3 };
      allMessages.sort((a, b) => {
        const orderA = typeOrder[a.visitingType as keyof typeof typeOrder] ?? 999;
        const orderB = typeOrder[b.visitingType as keyof typeof typeOrder] ?? 999;
        return orderA - orderB;
      });

      setMessages(allMessages);
      
    } catch (error) {
      console.error('❌ Failed to load messages:', error);
      toast.error('Failed to load existing messages');
      console.log('🔄 Creating default messages due to error...');
      createDefaultMessages();
    } finally {
      setIsLoading(false);
    }
  };

  const createDefaultMessages = () => {
    const visitingTypes: Array<'consistent' | 'semi-consistent' | 'easy-going' | 'rare' | 'new'> = [
      'consistent',
      'semi-consistent',
      'easy-going',
      'rare',
      'new'
    ];

    const titles = {
      'consistent': 'Consistent (Once every week)',
      'semi-consistent': 'Semi-Consistent (Once every 2-3 weeks)',
      'easy-going': 'Easy-Going (Once every 3-8 weeks)',
      'rare': 'Rare (Less than once every 2 months)',
      'new': 'New (Has only gone once)'
    };

    const defaultMessages: SMSMessage[] = visitingTypes.map((type) => ({
      id: uuidv4(),
      title: titles[type],
      message: '',
      visitingType: type,
      frequency: 'monthly',
      dayOfMonth: 1,
      hour: 10,
      minute: 0,
      period: 'AM',
      enabled: false,
      isSaved: false,
      isValidated: false,
      validationStatus: 'DRAFT',
      validationReason: undefined,
      isEditing: true,
    }));

    setMessages(defaultMessages);
  };

  const loadClientPreview = async () => {
    setLoadingPreview(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || '';
      const response = await fetch(`/api/client-messaging/preview-recipients?limit=50&userId=${userId}&algorithm=auto-nudge`);
      
      if (!response.ok) {
        throw new Error('Failed to load preview');
      }
      
      const data = await response.json();
      
      if (data.success) {
        const sortedClients = [...data.clients].sort((a, b) => 
          b.score - a.score
        );
        
        setPreviewClients(sortedClients);
        setPreviewStats(data.stats);

        // Group phone numbers by visiting type
        if (data.clients) {
          const grouped: Record<string, PhoneNumber[]> = {
            consistent: [],
            'semi-consistent': [],
            'easy-going': [],
            rare: []
          };

          data.clients.forEach((client: PreviewClient) => {
            if (client.visiting_type && grouped[client.visiting_type]) {
              grouped[client.visiting_type].push({
                full_name: `${client.first_name || ''} ${client.last_name || ''}`.trim(),
                phone_normalized: client.phone_normalized
              });
            }
          });

          setPhoneNumbersByType(grouped);
        }
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

  const draftAllActivatedMessages = async () => {
    const activatedMessages = messages.filter(m => m.validationStatus === 'ACCEPTED' && m.enabled);
    
    if (activatedMessages.length === 0) {
      toast.error('No activated messages to draft');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to draft ${activatedMessages.length} activated message(s)?\n\nThis will pause all active campaigns.`
    );
    
    if (!confirmed) return;

    setIsDraftingAll(true);
    try {
      const updatePromises = activatedMessages.map(msg =>
        fetch('/api/client-messaging/save-sms-schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{
              ...msg,
              validationStatus: 'DRAFT',
              enabled: false
            }]
          }),
        })
      );

      await Promise.all(updatePromises);

      setMessages(messages.map(m =>
        activatedMessages.find(am => am.id === m.id)
          ? { ...m, validationStatus: 'DRAFT', enabled: false }
          : m
      ));

      toast.success(`${activatedMessages.length} message(s) drafted successfully`);
    } catch (error) {
      console.error('Failed to draft messages:', error);
      toast.error('Failed to draft some messages');
    } finally {
      setIsDraftingAll(false);
    }
  };

  const handleSetSchedule = async () => {
    if (!scheduleDayOfMonth) {
      toast.error('Please select a day of the month');
      return;
    }

    if (!scheduleStartDate) {
      toast.error('Please select a start date');
      return;
    }

    try {
      // Get user session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.user?.id) {
        toast.error('Unable to get user session');
        return;
      }

      // Convert hour to 24-hour format
      let hour24 = scheduleHour;
      if (schedulePeriod === 'PM' && scheduleHour !== 12) {
        hour24 = scheduleHour + 12;
      } else if (schedulePeriod === 'AM' && scheduleHour === 12) {
        hour24 = 0;
      }

      // Build cron expression: minute hour day-of-month * *
      const cronExpression = `${scheduleMinute} ${hour24} ${scheduleDayOfMonth} * *`;
      
      // Format dates - handle both Date objects and strings
      const startDateStr = scheduleStartDate; 
      const endDateStr = scheduleEndDate || 'null';
      
      // Combine into the format: cron | startdate | enddate
      const autoNudgeSchedule = `${cronExpression} | ${startDateStr} | ${endDateStr}`;

      // Update profile with the schedule
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ auto_nudge_schedule: autoNudgeSchedule })
        .eq('user_id', session.user.id);

      if (updateError) {
        console.error('Error updating profile:', updateError);
        toast.error('Failed to save schedule');
        return;
      }

      // Apply schedule to all messages
      setMessages(messages.map(msg => ({
        ...msg,
        dayOfMonth: scheduleDayOfMonth,
        hour: scheduleHour,
        minute: scheduleMinute,
        period: schedulePeriod,
        frequency: 'monthly',
      })));

      setHasSchedule(true);
      setShowScheduleModal(false);
      toast.success('Schedule applied to all messages!');
    } catch (error) {
      console.error('Error setting schedule:', error);
      toast.error('An error occurred while setting schedule');
    }
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
          
          return updated;
        }
        return msg;
      })
    );
  };

  const enableEditMode = (id: string) => {
    const msg = messages.find((m) => m.id === id);
    if (msg) {
      setOriginalMessages({
        ...originalMessages,
        [id]: { ...msg },
      });
      updateMessage(id, { isEditing: true });
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

    if (mode === 'activate' && lockedMessages.has(msgId)) {
      toast.error('This message has already been sent this month. It will be unlocked next month.');
      return;
    }

    // Check if schedule is set
    if (!hasSchedule) {
      toast.error('Please set a monthly schedule first');
      setShowScheduleModal(true);
      return;
    }

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

    setIsSaving(true);
    setSavingMode(mode);
    try {
      // Use the schedule values directly since they come from the schedule modal
      // The schedule modal sets hour/minute/period correctly
      const messageToSave = {
        id: msg.id,
        title: msg.title,
        message: msg.message,
        visitingType: msg.visitingType,
        frequency: 'monthly',
        dayOfMonth: scheduleDayOfMonth,
        hour: scheduleHour,  // ← Use scheduleHour directly (already in 12hr format)
        minute: scheduleMinute,  // ← Use scheduleMinute directly
        period: schedulePeriod,  // ← Use schedulePeriod directly
        validationStatus: mode === 'draft' ? 'DRAFT' : 'ACCEPTED',
        purpose: 'auto-nudge'
      };

      const response = await fetch('/api/client-messaging/save-sms-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [messageToSave] }),
      });

      if (!response.ok) throw new Error('Failed to save schedule');

      const data = await response.json();
      if (data.success) {
        setMessages(messages.map(m =>
          m.id === msgId
            ? { 
                ...m, 
                isSaved: true, 
                isEditing: false, 
                validationStatus: mode === 'draft' ? 'DRAFT' : 'ACCEPTED',
                enabled: mode === 'activate',
                // Update the message with the schedule values
                dayOfMonth: scheduleDayOfMonth,
                hour: scheduleHour,
                minute: scheduleMinute,
                period: schedulePeriod,
                frequency: 'monthly'
              }
            : m
        ));
        toast.success(mode === 'draft' ? 'Draft saved!' : 'Schedule activated!');
      } else {
        toast.error('Failed to save');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to save SMS schedule');
    } finally {
      setIsSaving(false);
      setSavingMode(null);
    }
  };

  const handleDeactivate = async (msgId: string) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;

    setIsSaving(true);
    setSavingMode('draft');
    try {
      const messageToSave = {
        id: msg.id,
        title: msg.title,
        message: msg.message,
        visitingType: msg.visitingType,
        frequency: 'monthly',
        dayOfMonth: scheduleDayOfMonth,
        hour: scheduleHour,
        minute: scheduleMinute,
        period: schedulePeriod,
        validationStatus: 'DRAFT',
        purpose: 'auto-nudge'
      };

      const response = await fetch('/api/client-messaging/save-sms-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [messageToSave] }),
      });

      if (!response.ok) throw new Error('Failed to deactivate');

      const data = await response.json();
      if (data.success) {
        // Update with isEditing: true to keep it editable
        setMessages(messages.map(m =>
          m.id === msgId
            ? { 
                ...m, 
                isSaved: true, 
                isEditing: true,  // ← Keep it editable
                validationStatus: 'DRAFT',
                enabled: false,
                dayOfMonth: scheduleDayOfMonth,
                hour: scheduleHour,
                minute: scheduleMinute,
                period: schedulePeriod,
                frequency: 'monthly'
              }
            : m
        ));
        toast.success('Message deactivated and ready for editing');
      } else {
        toast.error('Failed to deactivate');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to deactivate message');
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
            const newReserved = oldReserved;
            
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

            // Update local credits
            setAvailableCredits(newAvailable);
          }
        }
      }

      toast.success('Test message sent successfully to your phone!');
      fetchTestMessageCount();
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
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl p-3 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between mb-3 sm:mb-4 gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-2xl font-bold text-white mb-2 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 sm:w-6 sm:h-6 text-sky-300" />
              SMS Auto Nudge
            </h2>
            
            <div className="grid grid-cols-2 lg:flex lg:flex-wrap items-center gap-1.5 sm:gap-2 mt-2 sm:mt-3">
              <button
                onClick={() => setShowAutoNudgeHistoryModal(true)}
                className="inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-purple-300/10 border border-purple-300/30 text-purple-300 rounded-lg font-semibold text-[10px] sm:text-sm hover:bg-purple-300/20 hover:border-purple-300/40 transition-all duration-300"
              >
                <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">Auto Nudge History</span>
                <span className="xs:hidden">History</span>
              </button>

              <button
                onClick={() => setShowHowAutoNudgeWorksModal(true)}
                className="inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-sky-300/10 border border-sky-300/30 text-sky-300 rounded-lg font-semibold text-[10px] sm:text-sm hover:bg-sky-300/20 hover:border-sky-300/40 transition-all duration-300"
              >
                <Info className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">How does this work?</span>
                <span className="xs:hidden">How it works</span>
              </button>
            </div>
            
            <p className="text-[#bdbdbd] text-xs sm:text-sm mt-2 sm:mt-3 hidden sm:block">
              Manage automated monthly marketing messages for each client type
            </p>
          </div>
          
          <div className="flex flex-col items-stretch lg:items-end gap-2 sm:gap-3">
            {/* Credits, Tests, and Action Buttons - All in one row on mobile */}
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

              <button
                onClick={draftAllActivatedMessages}
                disabled={isDraftingAll || messages.filter(m => m.validationStatus === 'ACCEPTED' && m.enabled).length === 0}
                className="px-2 py-1.5 sm:px-4 sm:py-2 bg-amber-300/20 text-amber-300 border border-amber-300/30 rounded-full font-semibold text-[10px] sm:text-sm hover:bg-amber-300/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 sm:gap-2 lg:col-span-2"
              >
                {isDraftingAll ? (
                  <>
                    <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                    <span className="hidden sm:inline">Drafting...</span>
                  </>
                ) : (
                  <>
                    <span className="hidden sm:inline">Draft All</span>
                    <span className="sm:hidden">Draft</span>
                  </>
                )}
              </button>
              
              <button
                onClick={() => {
                  loadClientPreview();
                  setShowPreview(true);
                }}
                disabled={loadingPreview}
                className="px-2 py-1.5 sm:px-4 sm:py-2 bg-white/10 text-sky-300 border border-sky-300/30 rounded-full font-semibold text-[10px] sm:text-sm hover:bg-white/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 sm:gap-2 lg:col-span-2"
              >
                {loadingPreview ? (
                  <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                ) : (
                  <>
                    <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Client Preview</span>
                    <span className="sm:hidden">Preview</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        
        {/* Schedule Info & Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 p-2.5 sm:p-4 bg-white/5 border border-white/10 rounded-xl">
          {hasSchedule ? (
            <div className="flex items-start sm:items-center gap-2 sm:gap-3 min-w-0">
              <Calendar className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-lime-300 flex-shrink-0 mt-0.5 sm:mt-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-sm font-semibold text-white truncate sm:whitespace-normal">
                  Monthly on day {scheduleDayOfMonth} at {scheduleHour}:{scheduleMinute.toString().padStart(2, '0')} {schedulePeriod}
                  {scheduleDayOfMonth > 28 && <span className="text-amber-300 ml-1 sm:ml-2">*</span>}
                </p>
                {scheduleDayOfMonth > 28 && (
                  <p className="text-[9px] sm:text-xs text-amber-300 mt-0.5 hidden sm:block">
                    * Adjusts to last day in shorter months
                  </p>
                )}
                <p className="text-[9px] sm:text-xs text-[#bdbdbd] hidden sm:block">
                  {scheduleStartDate && `Starting ${new Date(scheduleStartDate).toLocaleDateString()}`}
                  {scheduleEndDate && ` • Ending ${new Date(scheduleEndDate).toLocaleDateString()}`}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 sm:gap-3">
              <Clock className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-amber-300 flex-shrink-0" />
              <p className="text-[10px] sm:text-sm text-amber-300">No schedule set</p>
            </div>
          )}
          <button
            onClick={() => setShowScheduleModal(true)}
            className="flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-xl font-semibold text-[10px] sm:text-sm hover:bg-purple-500/30 transition-all duration-300 whitespace-nowrap"
          >
            <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
            {hasSchedule ? 'Edit' : 'Set Schedule'}
          </button>
        </div>
      </div>

      <HowAutoNudgeWorksModal 
        isOpen={showHowAutoNudgeWorksModal}
        onClose={() => setShowHowAutoNudgeWorksModal(false)}
      />

      <AutoNudgeHistoryModal 
        isOpen={showAutoNudgeHistoryModal}
        onClose={() => setShowAutoNudgeHistoryModal(false)}
      />

      {/* Test Message Confirmation Modal */}
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

      {/* Client Preview Modal */}
      <ClientPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        previewClients={previewClients}
        previewStats={previewStats}
      />

      {/* Schedule Modal */}
      <AnimatePresence>
        {showScheduleModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowScheduleModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/10 sticky top-0 bg-[#1a1a1a] z-10">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-purple-300" />
                    Set Monthly SMS Schedule
                  </h3>
                  <p className="text-xs sm:text-sm text-[#bdbdbd] mt-1">
                    All messages will be sent on this schedule
                  </p>
                </div>
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5 text-[#bdbdbd]" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                {/* Day of Month */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Day of Month *
                  </label>
                  <select
                    value={scheduleDayOfMonth}
                    onChange={(e) => setScheduleDayOfMonth(parseInt(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base text-white focus:outline-none focus:ring-2 focus:ring-purple-300/50 focus:border-purple-300/50 transition-all"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day} className="bg-[#1a1a1a]">
                        {day}
                      </option>
                    ))}
                  </select>
                  {scheduleDayOfMonth > 28 && (
                    <div className="p-2 sm:p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2 mt-2">
                      <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-300">
                        <strong>Note:</strong> In months with fewer than {scheduleDayOfMonth} days, messages will be sent on the last available day of that month.
                      </p>
                    </div>
                  )}
                  <p className="text-xs text-[#bdbdbd] mt-1">
                    Messages will be sent on the {scheduleDayOfMonth}{scheduleDayOfMonth === 1 ? 'st' : scheduleDayOfMonth === 2 ? 'nd' : scheduleDayOfMonth === 3 ? 'rd' : 'th'} of every month
                  </p>
                </div>

                {/* Time */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    <Clock className="w-3 h-3 inline mr-1" />
                    Time *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {/* Hour */}
                    <select
                      value={scheduleHour}
                      onChange={(e) => setScheduleHour(parseInt(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-2 sm:px-4 py-2 sm:py-3 text-sm sm:text-base text-white focus:outline-none focus:ring-2 focus:ring-purple-300/50 focus:border-purple-300/50 transition-all"
                    >
                      {Array.from({ length: 12 }, (_, i) => i === 0 ? 12 : i).map((hour) => (
                        <option key={hour} value={hour} className="bg-[#1a1a1a]">
                          {hour.toString().padStart(2, '0')}
                        </option>
                      ))}
                    </select>

                    {/* Minute */}
                    <select
                      value={scheduleMinute}
                      onChange={(e) => setScheduleMinute(parseInt(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-2 sm:px-4 py-2 sm:py-3 text-sm sm:text-base text-white focus:outline-none focus:ring-2 focus:ring-purple-300/50 focus:border-purple-300/50 transition-all"
                    >
                      {Array.from({ length: 60 }, (_, i) => i).map((minute) => (
                        <option key={minute} value={minute} className="bg-[#1a1a1a]">
                          {minute.toString().padStart(2, '0')}
                        </option>
                      ))}
                    </select>

                    {/* AM/PM */}
                    <select
                      value={schedulePeriod}
                      onChange={(e) => setSchedulePeriod(e.target.value as 'AM' | 'PM')}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-2 sm:px-4 py-2 sm:py-3 text-sm sm:text-base text-white focus:outline-none focus:ring-2 focus:ring-purple-300/50 focus:border-purple-300/50 transition-all"
                    >
                      <option value="AM" className="bg-[#1a1a1a]">AM</option>
                      <option value="PM" className="bg-[#1a1a1a]">PM</option>
                    </select>
                  </div>
                </div>

                {/* Start Date */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={scheduleStartDate}
                    onChange={(e) => setScheduleStartDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base text-white focus:outline-none focus:ring-2 focus:ring-purple-300/50 focus:border-purple-300/50 transition-all"
                  />
                  <p className="text-xs text-[#bdbdbd] mt-1">
                    When should the SMS nudging start?
                  </p>
                </div>

                {/* End Date */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={scheduleEndDate}
                    onChange={(e) => setScheduleEndDate(e.target.value)}
                    min={scheduleStartDate || new Date().toISOString().split('T')[0]}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base text-white focus:outline-none focus:ring-2 focus:ring-purple-300/50 focus:border-purple-300/50 transition-all"
                  />
                  <p className="text-xs text-[#bdbdbd] mt-1">
                    Messages will be drafted after this date
                  </p>
                </div>

                {/* Info Box */}
                <div className="p-3 sm:p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                  <p className="text-xs sm:text-sm text-purple-300">
                    <strong>Monthly Schedule:</strong> Messages will be sent on day {scheduleDayOfMonth} of every month at {scheduleHour}:{scheduleMinute.toString().padStart(2, '0')} {schedulePeriod}
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 sm:gap-3 p-4 sm:p-6 border-t border-white/10 sticky bottom-0 bg-[#1a1a1a]">
                <button
                  onClick={() => {
                    setShowScheduleModal(false);
                  }}
                  className="px-3 sm:px-4 py-2 bg-white/5 border border-white/10 text-[#bdbdbd] rounded-xl text-sm sm:text-base font-semibold hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSetSchedule}
                  disabled={!scheduleDayOfMonth || !scheduleStartDate}
                  className="px-3 sm:px-4 py-2 bg-purple-500/20 border border-purple-500/30 text-purple-300 rounded-xl text-sm sm:text-base font-semibold hover:bg-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Apply Schedule
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit confirmation modal */}
      <AnimatePresence>
        {showDeactivateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => {
              setShowDeactivateModal(false);
              setPendingDeactivateMessageId(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-300/20 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-amber-300" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-white">Deactivate Message?</h3>
                </div>
                <button
                  onClick={() => {
                    setShowDeactivateModal(false);
                    setPendingDeactivateMessageId(null);
                  }}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-[#bdbdbd]" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 sm:p-6">
                <p className="text-sm sm:text-base text-[#bdbdbd] mb-4">
                  This message will be converted to a <span className="text-amber-300 font-semibold">draft</span> and will <span className="text-amber-300 font-semibold">no longer be sent out</span> on the scheduled date.
                </p>
                <p className="text-sm sm:text-base text-[#bdbdbd]">
                  You can reactivate it later by editing and re-activating the message.
                </p>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 sm:gap-3 p-4 sm:p-6 border-t border-white/10">
                <button
                  onClick={() => {
                    setShowDeactivateModal(false);
                    setPendingDeactivateMessageId(null);
                  }}
                  className="px-3 sm:px-4 py-2 bg-white/5 border border-white/10 text-[#bdbdbd] rounded-xl text-sm sm:text-base font-semibold hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (pendingDeactivateMessageId) {
                      setShowDeactivateModal(false);
                      setPendingDeactivateMessageId(null);
                      await handleDeactivate(pendingDeactivateMessageId);
                    }
                  }}
                  className="px-3 sm:px-4 py-2 bg-amber-300/20 border border-amber-300/30 text-amber-300 rounded-xl text-sm sm:text-base font-semibold hover:bg-amber-300/30 transition-all"
                >
                  Deactivate Message
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages List */}
      <div className="space-y-4">
        {messages.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl p-8 sm:p-12 text-center">
            <MessageSquare className="w-12 h-12 sm:w-16 sm:h-16 text-[#bdbdbd] mx-auto mb-4 opacity-50" />
            <p className="text-[#bdbdbd] text-base sm:text-lg mb-2">No messages configured</p>
            <p className="text-[#bdbdbd]/70 text-xs sm:text-sm">
              Messages will be created automatically on first load
            </p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <MessageCard
              isLocked={lockedMessages.has(msg.id)}
              autoNudgeCampaignProgress={autoNudgeCampaignProgress[msg.id]} 
              key={msg.id}
              message={msg}
              index={index}
              isSaving={isSaving}
              savingMode={savingMode}
              validatingId={validatingId}
              editingTitleId={editingTitleId}
              tempTitle={tempTitle}
              phoneNumbers={phoneNumbersByType[msg.visitingType || 'consistent'] || []}
              testMessagesUsed={testMessagesUsed}
              availableCredits={availableCredits}
              profile={profile}
              onUpdate={updateMessage}
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
              onRequestTest={(msgId) => {
                setPendingTestMessageId(msgId);
                setShowTestConfirmModal(true);
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
              onRequestDeactivate={(msgId: string) => {
                setPendingDeactivateMessageId(msgId);
                setShowDeactivateModal(true);
              }}
              onTempTitleChange={setTempTitle}
            />
          ))
        )}
      </div>
    </div>
  );
}