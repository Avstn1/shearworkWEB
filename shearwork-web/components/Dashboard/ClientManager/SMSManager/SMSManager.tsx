'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MessageSquare, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { MessageCard } from './MessageCard';
import { SMSMessage } from './types';
import { supabase } from '@/utils/supabaseClient'

// Main component
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

          const isValidated = dbMsg.status !== 'DENIED';

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
            isValidated: isValidated, 
            validationStatus: dbMsg.status, // DRAFT, ACCEPTED, or DENIED
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
    const msg = messages.find((m) => m.id === id);
    
    // Show confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to delete "${msg?.title || 'this message'}"?\n\nThis action is irreversible and will permanently remove the scheduled message.`
    );
    
    if (!confirmed) {
      return; // User cancelled
    }

    // If message is saved, delete from database
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

  const cancelEdit = async (id: string) => {
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

    setIsSaving(true);
    setSavingMode(mode);
    try {
      // Convert 12hr to 24hr
      let hour24 = msg.hour;
      if (msg.period === 'PM' && msg.hour !== 12) hour24 += 12;
      else if (msg.period === 'AM' && msg.hour === 12) hour24 = 0;

      // Convert local 24hr time to UTC
      const local = new Date();
      local.setHours(hour24, msg.minute, 0, 0);
      const utcHour = local.getUTCHours();
      const utcMinute = local.getUTCMinutes();

      const messageToSave = {
        ...msg,
        hour: hour24, // local hour for display text
        minute: msg.minute,
        utcHour,
        utcMinute,
        validationStatus: mode === 'draft' ? 'DRAFT' : 'ACCEPTED',
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
            ? { ...m, isSaved: true, isEditing: false, validationStatus: mode === 'draft' ? 'DRAFT' : 'ACCEPTED' }
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
              <MessageCard
                key={msg.id}
                message={msg}
                index={index}
                isSaving={isSaving}
                savingMode={savingMode}
                validatingId={validatingId}
                editingTitleId={editingTitleId}
                tempTitle={tempTitle}
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

                    // Mark as validated but keep as DRAFT
                    // Only the Activate button should change status to ACCEPTED
                    updateMessage(msgId, {
                      isValidated: data.approved, // true if approved, false if denied
                      validationStatus: data.approved ? 'DRAFT' : 'DENIED', // Keep as DRAFT even when approved
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