'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Send, Clock, Calendar, MessageSquare, Save, Shield, CheckCircle, XCircle, AlertCircle, Pencil, Check, X, Loader2, Edit, FileText, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';

interface SMSMessage {
  id: string;
  title: string;
  message: string;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  dayOfWeek?: string;
  dayOfMonth?: number;
  hour: number;
  minute: number;
  period: 'AM' | 'PM';
  enabled: boolean;
  isSaved: boolean;
  isValidated?: boolean;
  validationStatus?: 'ACCEPTED' | 'DENIED' | 'DRAFT' | null;
  validationReason?: string;
  isEditing?: boolean;
}

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

const HOURS_12 = Array.from({ length: 12 }, (_, i) => ({
  value: i === 0 ? 12 : i,
  label: (i === 0 ? 12 : i).toString().padStart(2, '0'),
}));

const MINUTES = Array.from({ length: 60 }, (_, i) => ({
  value: i,
  label: i.toString().padStart(2, '0'),
}));

const PERIODS = [
  { value: 'AM', label: 'AM' },
  { value: 'PM', label: 'PM' },
];

const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => ({
  value: i + 1,
  label: (i + 1).toString(),
}));

export default function SMSManager() {
  const [messages, setMessages] = useState<SMSMessage[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [savingMode, setSavingMode] = useState<'draft' | 'activate' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState<string>('');
  const [originalMessages, setOriginalMessages] = useState<Record<string, SMSMessage>>({});

  // Load existing messages on mount
  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/client-messaging/save-sms-schedule', {
        method: 'GET',
      });

      if (!response.ok) throw new Error('Failed to load messages');

      const data = await response.json();
      
      if (data.success && data.messages) {
        // Convert database messages to frontend format
        const loadedMessages = data.messages.map((dbMsg: any) => {
          // Parse cron to extract time
          const cronParts = dbMsg.cron.split(' ');
          const minute = parseInt(cronParts[0]);
          const hour24 = parseInt(cronParts[1]);
          const dayOfMonthCron = cronParts[2];
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

          // Determine frequency and day
          let frequency: 'weekly' | 'biweekly' | 'monthly' = 'weekly';
          let dayOfWeek: string | undefined;
          let dayOfMonth: number | undefined;
          
          if (dayOfMonthCron !== '*') {
            frequency = 'monthly';
            dayOfMonth = parseInt(dayOfMonthCron);
          } else if (dayOfWeekCron !== '*') {
            frequency = 'weekly';
            const dayMap: Record<string, string> = {
              '0': 'sunday',
              '1': 'monday',
              '2': 'tuesday',
              '3': 'wednesday',
              '4': 'thursday',
              '5': 'friday',
              '6': 'saturday',
            };
            dayOfWeek = dayMap[dayOfWeekCron];
          }

          return {
            id: dbMsg.id,
            title: dbMsg.title,
            message: dbMsg.message,
            frequency,
            dayOfWeek,
            dayOfMonth,
            hour: hour12,
            minute,
            period,
            enabled: true,
            isSaved: true,
            isValidated: dbMsg.status === 'ACCEPTED',
            validationStatus: dbMsg.status,
            validationReason: undefined,
            isEditing: false,
          };
        });

        setMessages(loadedMessages);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
      toast.error('Failed to load existing messages');
    } finally {
      setIsLoading(false);
    }
  };

  const addMessage = () => {
    if (messages.length >= 3) {
      toast.error('Maximum of 3 scheduled messages allowed');
      return;
    }

    // Check if there's an unsaved draft
    const hasDraft = messages.some((msg) => !msg.isSaved);
    if (hasDraft) {
      toast.error('Please save or delete your current draft before creating a new message');
      return;
    }

    const newMessage: SMSMessage = {
      id: uuidv4(),
      title: `Message ${messages.length + 1}`,
      message: '',
      frequency: 'weekly',
      dayOfWeek: 'monday',
      hour: 10,
      minute: 0,
      period: 'AM',
      enabled: true,
      isSaved: false,
      isValidated: false,
      validationStatus: 'DRAFT',
      validationReason: undefined,
      isEditing: true,
    };

    setMessages([...messages, newMessage]);
  };

  const removeMessage = async (id: string) => {
    // If message is saved, delete from database
    const msg = messages.find((m) => m.id === id);
    if (msg?.isSaved) {
      try {
        const response = await fetch('/api/client-messaging/save-sms-schedule', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });

        if (!response.ok) throw new Error('Failed to delete message');
        
        toast.success('Message deleted');
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
          
          // If message content changes, reset validation
          if (updates.message !== undefined && updates.message !== msg.message) {
            updated.isValidated = false;
            updated.validationStatus = 'DRAFT';
            updated.validationReason = undefined;
          }
          
          // Clear irrelevant fields based on frequency
          if (updated.frequency === 'monthly') {
            delete updated.dayOfWeek;
            if (!updated.dayOfMonth) updated.dayOfMonth = 1;
          } else {
            delete updated.dayOfMonth;
            if (!updated.dayOfWeek) updated.dayOfWeek = 'monday';
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
      // Store original state for cancel functionality
      setOriginalMessages({
        ...originalMessages,
        [id]: { ...msg },
      });
      updateMessage(id, { isEditing: true });
    }
  };

  const cancelEdit = (id: string) => {
    const original = originalMessages[id];
    if (original) {
      // Restore original state
      setMessages(messages.map((msg) => (msg.id === id ? { ...original, isEditing: false } : msg)));
      // Clean up stored original
      const newOriginals = { ...originalMessages };
      delete newOriginals[id];
      setOriginalMessages(newOriginals);
    }
  };

  const startEditingTitle = (id: string, currentTitle: string) => {
    setEditingTitleId(id);
    setTempTitle(currentTitle);
  };

  const saveTitle = (id: string) => {
    if (tempTitle.trim()) {
      updateMessage(id, { title: tempTitle.trim() });
    }
    setEditingTitleId(null);
    setTempTitle('');
  };

  const cancelEditTitle = () => {
    setEditingTitleId(null);
    setTempTitle('');
  };

  const validateMessage = async (msgId: string) => {
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
      
      console.log('Validation Response:', {
        success: data.success,
        approved: data.approved,
        status: data.status,
        reason: data.reason,
        message: data.message,
      });

      if (!response.ok) {
        throw new Error(data.error || 'Validation failed');
      }

      updateMessage(msgId, {
        isValidated: true,
        validationStatus: data.status,
        validationReason: data.reason,
      });

      if (data.approved) {
        toast.success('Message approved!');
      }
    } catch (error: any) {
      console.error('Validation error:', error);
      toast.error(error.message || 'Failed to validate message');
    } finally {
      setValidatingId(null);
    }
  };

  const handleSave = async (msgId: string, mode: 'draft' | 'activate') => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;

    // Validate message content
    if (!msg.message.trim()) {
      toast.error('Please fill in message content');
      return;
    }

    if (msg.message.length < 100) {
      toast.error('Message must be at least 100 characters');
      return;
    }

    // For activate mode, validation is required
    if (mode === 'activate') {
      if (!msg.isValidated || msg.validationStatus !== 'ACCEPTED') {
        toast.error('Message must be validated and approved before activating');
        return;
      }
    }

    setIsSaving(true);
    setSavingMode(mode);
    try {
      // Convert 12hr to 24hr format for backend
      let hour24 = msg.hour;
      if (msg.period === 'PM' && msg.hour !== 12) {
        hour24 = msg.hour + 12;
      } else if (msg.period === 'AM' && msg.hour === 12) {
        hour24 = 0;
      }

      const messageToSave = {
        ...msg,
        hour: hour24,
        validationStatus: mode === 'draft' ? 'DRAFT' : 'ACCEPTED',
      };

      console.log(JSON.stringify({ messages: [messageToSave] }))

      const response = await fetch('/api/client-messaging/save-sms-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [messageToSave] }),
      });

      if (!response.ok) throw new Error('Failed to save schedule');
      
      const data = await response.json();
      
      console.log('Save Response:', data);

      if (data.success) {
        setMessages(messages.map(m => {
          if (m.id !== msgId) return m;
          return { 
            ...m, 
            isSaved: true,
            isEditing: false,
            validationStatus: mode === 'draft' ? 'DRAFT' : 'ACCEPTED',
          };
        }));
        
        // Clear original message state
        if (originalMessages[msgId]) {
          const newOriginals = { ...originalMessages };
          delete newOriginals[msgId];
          setOriginalMessages(newOriginals);
        }
        
        toast.success(mode === 'draft' ? 'Draft saved successfully!' : 'Schedule activated successfully!');
      } else {
        toast.error('Failed to save');
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save SMS schedule');
    } finally {
      setIsSaving(false);
      setSavingMode(null);
    }
  };

  const getSchedulePreview = (msg: SMSMessage) => {
    const minute = msg.minute ?? 0;
    const displayHour = msg.hour === 0 ? 12 : msg.hour > 12 ? msg.hour - 12 : msg.hour;
    const timeStr = `${displayHour}:${minute.toString().padStart(2, '0')} ${msg.period || 'AM'}`;
    
    if (msg.frequency === 'monthly') {
      return `Every month on day ${msg.dayOfMonth} at ${timeStr}`;
    } else if (msg.frequency === 'biweekly') {
      const day = DAYS_OF_WEEK.find((d) => d.value === msg.dayOfWeek)?.label;
      return `Every other ${day} at ${timeStr}`;
    } else {
      const day = DAYS_OF_WEEK.find((d) => d.value === msg.dayOfWeek)?.label;
      return `Every ${day} at ${timeStr}`;
    }
  };

  // Show loading state
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
          </div>
          
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
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl overflow-hidden"
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-sky-300/20 rounded-full flex items-center justify-center">
                        <span className="text-sky-300 font-bold">{index + 1}</span>
                      </div>
                      <div>
                        {/* Editable Title */}
                        {editingTitleId === msg.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={tempTitle}
                              onChange={(e) => setTempTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveTitle(msg.id);
                                if (e.key === 'Escape') cancelEditTitle();
                              }}
                              className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-300/50"
                              maxLength={30}
                              autoFocus
                              disabled={!msg.isEditing}
                            />
                            <button
                              onClick={() => saveTitle(msg.id)}
                              className="p-1 rounded hover:bg-lime-300/20 text-lime-300 transition-all"
                              disabled={!msg.isEditing}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelEditTitle}
                              className="p-1 rounded hover:bg-rose-300/20 text-rose-300 transition-all"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <h3 className="text-white font-semibold">
                              {msg.title}
                            </h3>
                            {msg.isEditing && (
                              <button
                                onClick={() => startEditingTitle(msg.id, msg.title)}
                                className="p-1 rounded hover:bg-white/10 text-[#bdbdbd] hover:text-white transition-all"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                        <p className="text-xs text-[#bdbdbd] flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {getSchedulePreview(msg)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Edit Button (only show if not editing and message is saved) */}
                      {!msg.isEditing && msg.isSaved && (
                        <button
                          onClick={() => enableEditMode(msg.id)}
                          className="px-3 py-1 rounded-full text-xs font-semibold bg-white/5 text-[#bdbdbd] border border-white/10 hover:bg-white/10 hover:text-white transition-all duration-300 flex items-center gap-1"
                        >
                          <Edit className="w-3 h-3" />
                          Edit
                        </button>
                      )}

                      {/* Validation Status Badge */}
                      {msg.isValidated && msg.validationStatus === 'ACCEPTED' && (
                        <div className="px-3 py-1 rounded-full text-xs font-semibold bg-lime-300/20 text-lime-300 border border-lime-300/30 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Approved
                        </div>
                      )}
                      {msg.isValidated && msg.validationStatus === 'DENIED' && (
                        <div className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-300/20 text-rose-300 border border-rose-300/30 flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          Denied
                        </div>
                      )}

                      {/* Status Badge */}
                      {msg.isSaved ? (
                        msg.validationStatus === 'ACCEPTED' ? (
                          <button
                            onClick={() =>
                              updateMessage(msg.id, { enabled: !msg.enabled })
                            }
                            disabled={!msg.isEditing}
                            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-300 ${
                              msg.enabled
                                ? 'bg-lime-300/20 text-lime-300 border border-lime-300/30'
                                : 'bg-white/5 text-[#bdbdbd] border border-white/10'
                            } ${!msg.isEditing ? 'cursor-not-allowed opacity-70' : ''}`}
                          >
                            {msg.enabled ? 'Active' : 'Paused'}
                          </button>
                        ) : (
                          <div className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-300/20 text-amber-300 border border-amber-300/30">
                            Draft
                          </div>
                        )
                      ) : (
                        <div className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-300/20 text-amber-300 border border-amber-300/30">
                          Draft
                        </div>
                      )}

                      {/* Delete Button */}
                      <button
                        onClick={() => removeMessage(msg.id)}
                        className="p-2 rounded-full bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all duration-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Validation Reason Alert */}
                  {msg.isValidated && msg.validationStatus === 'DENIED' && msg.validationReason && (
                    <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-rose-300">{msg.validationReason}</p>
                    </div>
                  )}

                  {/* 50/50 Split Layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* LEFT: Message Content (50%) */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-[#bdbdbd] mb-2">
                          Message Content (SMS limits: 100-240 characters)
                        </label>
                        <div className="relative">
                          <textarea
                            value={msg.message}
                            onChange={(e) =>
                              updateMessage(msg.id, { message: e.target.value })
                            }
                            placeholder="Type your marketing message here..."
                            rows={8}
                            disabled={!msg.isEditing}
                            className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-20 text-white placeholder-[#bdbdbd]/50 focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300/50 transition-all resize-none ${
                              !msg.isEditing ? 'cursor-not-allowed opacity-70' : ''
                            }`}
                            maxLength={240}
                          />
                          <span
                            className={`absolute top-3 right-3 text-xs font-medium ${
                              msg.message.length < 100
                                ? 'text-amber-400'
                                : msg.message.length > 240
                                ? 'text-rose-400'
                                : 'text-lime-300'
                            }`}
                          >
                            {msg.message.length}/240
                          </span>
                        </div>
                      </div>

                      {/* Validate Button */}
                      {msg.isEditing && (
                        <button
                          onClick={() => validateMessage(msg.id)}
                          disabled={msg.message.length < 100 || validatingId === msg.id}
                          className="w-full flex items-center justify-center gap-2 px-6 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl font-semibold hover:bg-white/10 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {validatingId === msg.id ? (
                            <>
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                              >
                                <Shield className="w-5 h-5" />
                              </motion.div>
                              Validating...
                            </>
                          ) : (
                            <>
                              <Shield className="w-5 h-5" />
                              Validate Message
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* RIGHT: Schedule Settings (50%) */}
                    <div className="space-y-4">
                      {/* Frequency */}
                      <div>
                        <label className="block text-sm font-medium text-[#bdbdbd] mb-2">
                          <Calendar className="w-3 h-3 inline mr-1" />
                          Frequency
                        </label>
                        <select
                          value={msg.frequency}
                          onChange={(e) =>
                            updateMessage(msg.id, {
                              frequency: e.target.value as SMSMessage['frequency'],
                            })
                          }
                          disabled={!msg.isEditing}
                          className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300/50 transition-all appearance-none cursor-pointer ${
                            !msg.isEditing ? 'cursor-not-allowed opacity-70' : ''
                          }`}
                        >
                          <option value="weekly" className="bg-[#1a1a1a]">
                            Weekly
                          </option>
                          <option value="biweekly" className="bg-[#1a1a1a]">
                            Bi-weekly
                          </option>
                          <option value="monthly" className="bg-[#1a1a1a]">
                            Monthly
                          </option>
                        </select>
                      </div>

                      {/* Day Selection */}
                      <div>
                        <label className="block text-sm font-medium text-[#bdbdbd] mb-2">
                          {msg.frequency === 'monthly' ? 'Day of Month' : 'Day of Week'}
                        </label>
                        {msg.frequency === 'monthly' ? (
                          <select
                            value={msg.dayOfMonth || 1}
                            onChange={(e) =>
                              updateMessage(msg.id, {
                                dayOfMonth: parseInt(e.target.value),
                              })
                            }
                            disabled={!msg.isEditing}
                            className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300/50 transition-all appearance-none cursor-pointer ${
                              !msg.isEditing ? 'cursor-not-allowed opacity-70' : ''
                            }`}
                          >
                            {DAYS_OF_MONTH.map((day) => (
                              <option
                                key={day.value}
                                value={day.value}
                                className="bg-[#1a1a1a]"
                              >
                                {day.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <select
                            value={msg.dayOfWeek}
                            onChange={(e) =>
                              updateMessage(msg.id, { dayOfWeek: e.target.value })
                            }
                            disabled={!msg.isEditing}
                            className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300/50 transition-all appearance-none cursor-pointer ${
                              !msg.isEditing ? 'cursor-not-allowed opacity-70' : ''
                            }`}
                          >
                            {DAYS_OF_WEEK.map((day) => (
                              <option
                                key={day.value}
                                value={day.value}
                                className="bg-[#1a1a1a]"
                              >
                                {day.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* Time - 12hr format with AM/PM */}
                      <div>
                        <label className="block text-sm font-medium text-[#bdbdbd] mb-2">
                          <Clock className="w-3 h-3 inline mr-1" />
                          Time
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {/* Hour */}
                          <select
                            value={msg.hour === 0 ? 12 : msg.hour > 12 ? msg.hour - 12 : msg.hour}
                            onChange={(e) => {
                              const newHour = parseInt(e.target.value);
                              updateMessage(msg.id, { hour: newHour });
                            }}
                            disabled={!msg.isEditing}
                            className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300/50 transition-all appearance-none cursor-pointer ${
                              !msg.isEditing ? 'cursor-not-allowed opacity-70' : ''
                            }`}
                          >
                            {HOURS_12.map((hour) => (
                              <option
                                key={hour.value}
                                value={hour.value}
                                className="bg-[#1a1a1a]"
                              >
                                {hour.label}
                              </option>
                            ))}
                          </select>

                          {/* Minute */}
                          <select
                            value={msg.minute}
                            onChange={(e) =>
                              updateMessage(msg.id, {
                                minute: parseInt(e.target.value),
                              })
                            }
                            disabled={!msg.isEditing}
                            className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300/50 transition-all appearance-none cursor-pointer ${
                              !msg.isEditing ? 'cursor-not-allowed opacity-70' : ''
                            }`}
                          >
                            {MINUTES.map((minute) => (
                              <option
                                key={minute.value}
                                value={minute.value}
                                className="bg-[#1a1a1a]"
                              >
                                {minute.label}
                              </option>
                            ))}
                          </select>

                          {/* AM/PM */}
                          <select
                            value={msg.period}
                            onChange={(e) =>
                              updateMessage(msg.id, {
                                period: e.target.value as 'AM' | 'PM',
                              })
                            }
                            disabled={!msg.isEditing}
                            className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300/50 transition-all appearance-none cursor-pointer ${
                              !msg.isEditing ? 'cursor-not-allowed opacity-70' : ''
                            }`}
                          >
                            {PERIODS.map((period) => (
                              <option
                                key={period.value}
                                value={period.value}
                                className="bg-[#1a1a1a]"
                              >
                                {period.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      {msg.isEditing ? (
                        <div className="space-y-2">
                          {/* Two Choice Buttons */}
                          <div className="grid grid-cols-2 gap-2">
                            {/* Save as Draft */}
                            <button
                              onClick={() => handleSave(msg.id, 'draft')}
                              disabled={isSaving || msg.message.length < 100}
                              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition-all duration-300 ${
                                isSaving || msg.message.length < 100
                                  ? 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                                  : 'bg-amber-300/20 text-amber-300 border border-amber-300/30 hover:bg-amber-300/30'
                              }`}
                            >
                              {isSaving && savingMode === 'draft' ? (
                                <>
                                  <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                  >
                                    <Clock className="w-5 h-5" />
                                  </motion.div>
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <FileText className="w-5 h-5" />
                                  Save Draft
                                </>
                              )}
                            </button>

                            {/* Activate Schedule */}
                            <button
                              onClick={() => handleSave(msg.id, 'activate')}
                              disabled={
                                isSaving ||
                                msg.message.length < 100 ||
                                !msg.isValidated ||
                                msg.validationStatus !== 'ACCEPTED'
                              }
                              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition-all duration-300 ${
                                isSaving ||
                                msg.message.length < 100 ||
                                !msg.isValidated ||
                                msg.validationStatus !== 'ACCEPTED'
                                  ? 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                                  : 'bg-gradient-to-r from-sky-300 to-lime-300 text-black hover:shadow-[0_0_20px_rgba(125,211,252,0.6)]'
                              }`}
                            >
                              {isSaving && savingMode === 'activate' ? (
                                <>
                                  <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                  >
                                    <Clock className="w-5 h-5" />
                                  </motion.div>
                                  Activating...
                                </>
                              ) : (
                                <>
                                  <Zap className="w-5 h-5" />
                                  Activate
                                </>
                              )}
                            </button>
                          </div>

                          {/* Cancel Button */}
                          {msg.isSaved && (
                            <button
                              onClick={() => cancelEdit(msg.id)}
                              className="w-full px-6 py-3 rounded-xl font-bold bg-white/5 text-[#bdbdbd] hover:bg-white/10 hover:text-white transition-all duration-300 border border-white/10"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Preview Banner */}
                <div className="bg-sky-300/10 border-t border-sky-300/20 px-6 py-3">
                  <p className="text-xs text-sky-300 flex items-center gap-2">
                    <Send className="w-3 h-3" />
                    <span className="font-medium">Next send:</span>
                    <span className="text-sky-200">{getSchedulePreview(msg)}</span>
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}