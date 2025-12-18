'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MessageSquare, Loader2, Users, X, Clock, Calendar, AlertCircle } from 'lucide-react';
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
export default function SMSManager() {
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
  // #endregion

  // Load existing messages on mount
  useEffect(() => {
    loadMessages();
    loadClientPreview();
  }, []);

  // Safety check - if messages is still empty after loading, create defaults
  useEffect(() => {
    if (!isLoading && messages.length === 0) {
      createDefaultMessages();
    }
  }, [isLoading, messages.length]);

  const loadMessages = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/client-messaging/save-sms-schedule', {
        method: 'GET',
      });

      if (!response.ok) {
        console.log('❌ Response not OK, throwing error');
        throw new Error('Failed to load messages');
      }

      const data = await response.json();
      
      // Define all possible visiting types and their titles
      const visitingTypes: Array<'consistent' | 'semi-consistent' | 'easy-going' | 'rare'> = [
        'consistent',
        'semi-consistent',
        'easy-going',
        'rare'
      ];

      const titles = {
        'consistent': 'Consistent (Once every week)',
        'semi-consistent': 'Semi-Consistent (Once every 2-3 weeks)',
        'easy-going': 'Easy-Going (Once every 3-8 weeks)',
        'rare': 'Rare (Less than once every 2 months)',
      };

      // Start with an empty array
      const allMessages: SMSMessage[] = [];
      
      // Track which visiting types we've loaded from the database
      const loadedTypes = new Set<string>();
      
      // First, process all saved messages from the database
      if (data.success && data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
        
        data.messages.forEach((dbMsg: any) => {
          console.log('📝 Processing saved message:', {
            visiting_type: dbMsg.visiting_type,
            title: dbMsg.title,
            status: dbMsg.status
          });
          
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
            console.log('✅ Added saved message for type:', dbMsg.visiting_type);
          }

          // Set schedule from first saved message if exists
          if (!hasSchedule && allMessages.length === 1) {
            setScheduleDayOfMonth(dayOfMonth);
            setScheduleHour(hour12);
            setScheduleMinute(minute);
            setSchedulePeriod(period);
            setHasSchedule(true);
          }
        });
      } else {
        console.log('⚠️ No saved messages found in database');
      }

      // Now create defaults for any missing types
      visitingTypes.forEach((type) => {
        if (!loadedTypes.has(type)) {
          console.log('🆕 Creating default message for missing type:', type);
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
      console.log('✅ loadMessages complete, setting isLoading to false');
      setIsLoading(false);
    }
  };

  const createDefaultMessages = () => {
    const visitingTypes: Array<'consistent' | 'semi-consistent' | 'easy-going' | 'rare'> = [
      'consistent',
      'semi-consistent',
      'easy-going',
      'rare'
    ];

    const titles = {
      'consistent': 'Consistent (Once every week)',
      'semi-consistent': 'Semi-Consistent (Once every 2-3 weeks)',
      'easy-going': 'Easy-Going (Once every 3-8 weeks)',
      'rare': 'Rare (Less than once every 2 months)',
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
      const response = await fetch(`/api/client-messaging/preview-recipients?limit=25&userId=${userId}`);
      
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

  const handleSetSchedule = () => {
    if (!scheduleDayOfMonth) {
      toast.error('Please select a day of the month');
      return;
    }

    if (!scheduleStartDate) {
      toast.error('Please select a start date');
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
      let hour24 = msg.hour;
      if (msg.period === 'PM' && msg.hour !== 12) hour24 += 12;
      else if (msg.period === 'AM' && msg.hour === 12) hour24 = 0;

      const local = new Date();
      local.setHours(hour24, msg.minute, 0, 0);
      const utcHour = local.getUTCHours();
      const utcMinute = local.getUTCMinutes();

      const messageToSave = {
        ...msg,
        visiting_type: msg.visitingType,
        hour: hour24,
        minute: msg.minute,
        utcHour,
        utcMinute,
        validationStatus: mode === 'draft' ? 'DRAFT' : 'ACCEPTED',
        startDate: scheduleStartDate,
        endDate: scheduleEndDate || null,
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
                enabled: mode === 'activate' // ← ADD THIS LINE
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
              Manage automated monthly marketing messages for each client type
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={draftAllActivatedMessages}
              disabled={isDraftingAll || messages.filter(m => m.validationStatus === 'ACCEPTED' && m.enabled).length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-amber-300/20 text-amber-300 border border-amber-300/30 rounded-full font-semibold text-sm hover:bg-amber-300/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDraftingAll ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Drafting...
                </>
              ) : (
                <>Draft All</>
              )}
            </button>
            
            <button
              onClick={() => {
                loadClientPreview();
                setShowPreview(true);
              }}
              disabled={loadingPreview}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 text-sky-300 border border-sky-300/30 rounded-full font-semibold text-sm hover:bg-white/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingPreview ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Users className="w-4 h-4" />
              )}
              Client Preview
            </button>
          </div>
        </div>
        
        {/* Schedule Info & Button */}
        <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
          {hasSchedule ? (
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-lime-300" />
              <div>
                <p className="text-sm font-semibold text-white">
                  Monthly on day {scheduleDayOfMonth} at {scheduleHour}:{scheduleMinute.toString().padStart(2, '0')} {schedulePeriod}
                  {scheduleDayOfMonth > 28 && <span className="text-amber-300 ml-2">*</span>}
                </p>
                {scheduleDayOfMonth > 28 && (
                  <p className="text-xs text-amber-300 mt-0.5">
                    * Adjusts to last day in shorter months
                  </p>
                )}
                <p className="text-xs text-[#bdbdbd]">
                  {scheduleStartDate && `Starting ${new Date(scheduleStartDate).toLocaleDateString()}`}
                  {scheduleEndDate && ` • Ending ${new Date(scheduleEndDate).toLocaleDateString()}`}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-300" />
              <p className="text-sm text-amber-300">No schedule set - required to save messages</p>
            </div>
          )}
          <button
            onClick={() => setShowScheduleModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-xl font-semibold text-sm hover:bg-purple-500/30 transition-all duration-300"
          >
            <Clock className="w-4 h-4" />
            {hasSchedule ? 'Edit Schedule' : 'Set Schedule'}
          </button>
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
                    Clients Selected for Next Campaign
                  </h3>
                  {previewStats && (
                    <p className="text-sm text-[#bdbdbd] mt-1">
                      {previewStats.total_selected} clients will receive your next SMS
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
              className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl max-w-lg w-full"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-purple-300" />
                    Set Monthly SMS Schedule
                  </h3>
                  <p className="text-sm text-[#bdbdbd] mt-1">
                    All messages will be sent on this schedule
                  </p>
                </div>
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-[#bdbdbd]" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6">
                {/* Day of Week */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Day of Month *
                  </label>
                  <select
                    value={scheduleDayOfMonth}
                    onChange={(e) => setScheduleDayOfMonth(parseInt(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-300/50 focus:border-purple-300/50 transition-all"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day} className="bg-[#1a1a1a]">
                        {day}
                      </option>
                    ))}
                  </select>
                  {scheduleDayOfMonth > 28 && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2 mt-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
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
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-300/50 focus:border-purple-300/50 transition-all"
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
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-300/50 focus:border-purple-300/50 transition-all"
                    >
                      {/* {[0, 15, 30, 45].map((minute) => ( */}
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
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-300/50 focus:border-purple-300/50 transition-all"
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
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-300/50 focus:border-purple-300/50 transition-all"
                  />
                  <p className="text-xs text-[#bdbdbd] mt-1">
                    When should the campaign start?
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
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-300/50 focus:border-purple-300/50 transition-all"
                  />
                  <p className="text-xs text-[#bdbdbd] mt-1">
                    Messages will be drafted after this date
                  </p>
                </div>

                {/* Info Box */}
                <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                  <p className="text-sm text-purple-300">
                    <strong>Monthly Schedule:</strong> Messages will be sent on day {scheduleDayOfMonth} of every month at {scheduleHour}:{scheduleMinute.toString().padStart(2, '0')} {schedulePeriod}
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
                <button
                  onClick={() => {
                    setShowScheduleModal(false);
                  }}
                  className="px-4 py-2 bg-white/5 border border-white/10 text-[#bdbdbd] rounded-xl font-semibold hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSetSchedule}
                  disabled={!scheduleDayOfMonth || !scheduleStartDate}
                  className="px-4 py-2 bg-purple-500/20 border border-purple-500/30 text-purple-300 rounded-xl font-semibold hover:bg-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Apply Schedule
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages List */}
      <div className="space-y-4">
        {messages.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl p-12 text-center">
            <MessageSquare className="w-16 h-16 text-[#bdbdbd] mx-auto mb-4 opacity-50" />
            <p className="text-[#bdbdbd] text-lg mb-2">No messages configured</p>
            <p className="text-[#bdbdbd]/70 text-sm">
              Messages will be created automatically on first load
            </p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <MessageCard
              key={msg.id}
              message={msg}
              index={index}
              isSaving={isSaving}
              savingMode={savingMode}
              validatingId={validatingId}
              editingTitleId={editingTitleId}
              tempTitle={tempTitle}
              phoneNumbers={phoneNumbersByType[msg.visitingType || 'consistent'] || []}
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
          ))
        )}
      </div>
    </div>
  );
}