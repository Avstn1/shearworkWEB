import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Clock, CheckCircle, XCircle, Edit, Pencil, Check, X, Send, Loader2, Users, Lock, AlertCircle, Calendar } from 'lucide-react';
import { SMSMessage, PhoneNumber } from './types';
import { MessageContent } from './MessageContent';
import { supabase } from '@/utils/supabaseClient';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

import { MessageClientList } from './MessageClientList'

interface Recipient {
  phone_normalized: string;
  is_sent: boolean;
  reason: string | null;
  created_at: string;
  client_id: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface MessageCardProps {
  profile: any;
  availableCredits?: number;
  message: SMSMessage;
  index: number;
  isSaving: boolean;
  savingMode: 'draft' | 'activate' | null;
  validatingId: string | null;
  editingTitleId: string | null;
  tempTitle: string;
  phoneNumbers: PhoneNumber[];
  testMessagesUsed: number;
  isLocked?: boolean; // NEW: Lock indicator from parent
  onUpdate: (id: string, updates: Partial<SMSMessage>) => void;
  onEnableEdit?: (id: string) => void;
  onCancelEdit: (id: string) => void;
  onSave: (msgId: string, mode: 'draft' | 'activate') => void;
  onValidate: (msgId: string) => void;
  onRequestTest: (msgId: string) => void;
  onRequestDeactivate: (msgId: string) => void;
  onStartEditingTitle: (id: string, currentTitle: string) => void;
  onSaveTitle: (id: string) => void;
  onCancelEditTitle: () => void;
  onTempTitleChange: (title: string) => void;
}

export function MessageCard({
  profile,
  availableCredits,
  message: msg,
  index,
  isSaving,
  testMessagesUsed,
  savingMode,
  validatingId,
  editingTitleId,
  tempTitle,
  phoneNumbers,
  isLocked = false, // NEW
  onUpdate,
  onEnableEdit,
  onCancelEdit,
  onSave,
  onValidate,
  onRequestTest,
  onRequestDeactivate,
  onStartEditingTitle,
  onSaveTitle,
  onCancelEditTitle,
  onTempTitleChange,
}: MessageCardProps) {
  
  const [showRecipientsModal, setShowRecipientsModal] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [recipientsStats, setRecipientsStats] = useState<{ total: number; successful: number; failed: number } | null>(null);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [lastSentDate, setLastSentDate] = useState<string | null>(null);

  // Fetch the last time this message was sent
  useEffect(() => {
    if (msg.id) {
      fetchLastSentDate();
    }
  }, [msg.id]);

  const fetchLastSentDate = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('sms_scheduled_messages')
        .select('created_at')
        .eq('id', msg.id)
        .eq('user_id', user.id)
        .eq('purpose', 'auto-nudge')
        .eq('is_finished', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // Ignore "no rows" error
        console.error('Error fetching last sent date:', error);
        return;
      }

      if (data) {
        setLastSentDate(data.created_at);
      }
    } catch (error) {
      console.error('Failed to fetch last sent date:', error);
    }
  };

  const fetchRecipients = async () => {
    setLoadingRecipients(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const response = await fetch(`/api/client-messaging/get-auto-nudge-recipients?messageId=${msg.id}&userId=${user.id}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch recipients');
      }

      const data = await response.json();
      
      if (data.success) {
        setRecipients(data.recipients || []);
        setRecipientsStats(data.stats || null);
        setShowRecipientsModal(true);
      }
    } catch (error) {
      console.error('Failed to fetch recipients:', error);
      toast.error('Failed to load recipients');
    } finally {
      setLoadingRecipients(false);
    }
  };

  const getSchedulePreview = () => {
    const minute = msg.minute ?? 0;
    const displayHour = msg.hour === 0 ? 12 : msg.hour > 12 ? msg.hour - 12 : msg.hour;
    const timeStr = `${displayHour}:${minute.toString().padStart(2, '0')} ${msg.period || 'AM'}`;
    
    return `Monthly on day ${msg.dayOfMonth} at ${timeStr}`;
  };

  const getNextSendDate = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const currentDay = now.getDate();
    
    let targetMonth = currentMonth;
    let targetYear = currentYear;
    
    // If we've passed the day this month, show next month
    if (currentDay >= (msg.dayOfMonth || 1)) { 
      targetMonth += 1;
      if (targetMonth > 11) {
        targetMonth = 0;
        targetYear += 1;
      }
    }
    
    // Handle months with fewer days
    const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const actualDay = Math.min(msg.dayOfMonth || 1, daysInTargetMonth);
    
    const nextDate = new Date(targetYear, targetMonth, actualDay);
    return nextDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const getUnlockDate = () => {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Determine edit capabilities
  const canEdit = !isLocked && msg.isSaved && !msg.isEditing;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className={`bg-white/5 backdrop-blur-lg border rounded-2xl shadow-xl overflow-visible ${
        isLocked ? 'border-amber-300/30' : 'border-white/10'
      }`}
    >
      {/* Locked Banner */}
      {isLocked && (
        <div className="px-6 py-3 flex items-center gap-2 bg-amber-300/10 border-b border-amber-300/20">
          <Lock className="w-4 h-4 text-amber-300" />
          <p className="text-sm font-semibold text-amber-300">
            Already sent this month - Message will unlock on {getUnlockDate()}
          </p>
        </div>
      )}

      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              msg.validationStatus === 'ACCEPTED' && msg.enabled
                ? 'bg-lime-300/20 text-lime-300'
                : isLocked
                  ? 'bg-amber-300/20 text-amber-300'
                  : 'bg-sky-300/20 text-sky-300'
            }`}>
              {msg.validationStatus === 'ACCEPTED' && msg.enabled ? (
                <CheckCircle className="w-5 h-5" />
              ) : isLocked ? (
                <Lock className="w-5 h-5" />
              ) : (
                <span className="font-bold">{index + 1}</span>
              )}
            </div>
            <div>
              {/* Editable Title */}
              {editingTitleId === msg.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tempTitle}
                    onChange={(e) => onTempTitleChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onSaveTitle(msg.id);
                      if (e.key === 'Escape') onCancelEditTitle();
                    }}
                    className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-300/50"
                    maxLength={50}
                    autoFocus
                    disabled={!msg.isEditing}
                  />
                  <button
                    onClick={() => onSaveTitle(msg.id)}
                    className="p-1 rounded hover:bg-lime-300/20 text-lime-300 transition-all"
                    disabled={!msg.isEditing}
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={onCancelEditTitle}
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
                  {msg.isEditing && !isLocked && (
                    <button
                      onClick={() => onStartEditingTitle(msg.id, msg.title)}
                      className="p-1 rounded hover:bg-white/10 text-[#bdbdbd] hover:text-white transition-all"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
              <p className="text-xs text-[#bdbdbd] flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {getSchedulePreview()}
                {msg.validationStatus !== 'ACCEPTED' || !msg.enabled ? ' | Inactive' : ''}
              </p>
            </div>
          </div>
          
          {/* Status Cards */}
          <div className="flex items-center gap-2">
            {/* View Recipients Button - Only show if message has been sent */}
            {lastSentDate && (
              <div className="relative group">
                <button
                  onClick={fetchRecipients}
                  disabled={loadingRecipients}
                  className="px-3 py-1 rounded-full text-xs font-semibold bg-white/5 text-[#bdbdbd] border border-white/10 hover:bg-white/10 hover:text-sky-300 transition-all duration-300 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingRecipients ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Users className="w-3 h-3" />
                  )}
                  Last Campaign
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none whitespace-nowrap">
                  <div className="bg-[#0a0a0a] border border-white/20 rounded-lg px-3 py-2 text-xs text-white shadow-xl">
                    View last month's recipients
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                      <div className="border-4 border-transparent border-t-[#0a0a0a]" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Edit Button */}
            {canEdit && msg.validationStatus !== 'ACCEPTED' && (
              <div className="relative group">
                <button
                  onClick={() => onEnableEdit?.(msg.id)}
                  className="px-3 py-1 rounded-full text-xs font-semibold bg-white/5 text-[#bdbdbd] border border-white/10 hover:bg-white/10 hover:text-white transition-all duration-300 flex items-center gap-1"
                >
                  <Edit className="w-3 h-3" />
                  Edit
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none whitespace-nowrap">
                  <div className="bg-[#0a0a0a] border border-white/20 rounded-lg px-3 py-2 text-xs text-white shadow-xl">
                    Edit this message
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                      <div className="border-4 border-transparent border-t-[#0a0a0a]" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Active/Draft Toggle - Only show if saved and not locked */}
            {msg.isSaved && !isLocked && (
              <button
                onClick={() => {
                  if (msg.validationStatus === 'ACCEPTED' && msg.enabled) {
                    onRequestDeactivate(msg.id);
                  } else {
                    toast.error('Please use the Activate button to schedule this message');
                  }
                }}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                  msg.validationStatus === 'ACCEPTED' && msg.enabled
                    ? 'bg-lime-300/20 text-lime-300 border border-lime-300/30 hover:bg-lime-300/30'
                    : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                }`}
              >
                {msg.validationStatus === 'ACCEPTED' && msg.enabled ? 'Active - Click to toggle' : 'Inactive'}
              </button>
            )}

            <div className="flex items-center gap-2">
              {/* Saved/Draft Badge */}
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                msg.isSaved 
                  ? 'bg-lime-300/10 text-lime-300 border border-lime-300/20'
                  : 'bg-amber-300/10 text-amber-300 border border-amber-300/20'
              }`}>
                {msg.isSaved ? 'Saved' : 'Draft'}
              </span>

              {/* Verified Badge */}
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                msg.isValidated
                  ? 'bg-sky-300/10 text-sky-300 border border-sky-300/20'
                  : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
              }`}>
                {msg.isValidated ? 'Verified' : 'Unverified'}
              </span>
            </div>

            {/* Locked indicator */}
            {isLocked && (
              <div className="relative group">
                <div className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-300/10 text-amber-300 border border-amber-300/20 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Locked
                </div>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none whitespace-nowrap">
                  <div className="bg-[#0a0a0a] border border-white/20 rounded-lg px-3 py-2 text-xs text-white shadow-xl">
                    Already sent this month - unlocks {getUnlockDate()}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                      <div className="border-4 border-transparent border-t-[#0a0a0a]" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Last Sent Info */}
        {lastSentDate && (
          <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-lime-300" />
                <span className="text-sm font-semibold text-white">
                  Last sent: {new Date(lastSentDate).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </span>
              </div>
              {recipientsStats && (
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-lime-300">{recipientsStats.successful} sent</span>
                  {recipientsStats.failed > 0 && (
                    <span className="text-rose-300">{recipientsStats.failed} failed</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: Message Content (50%) */}
          <MessageContent
            message={msg}
            validatingId={validatingId}
            testMessagesUsed={testMessagesUsed}
            profile={profile}
            onUpdate={onUpdate}
            onValidate={onValidate}
            onRequestTest={onRequestTest}
          />

          {/* RIGHT: Recipients List (50%) */}
          <MessageClientList
            message={msg}
            phoneNumbers={phoneNumbers}
            isSaving={isSaving}
            savingMode={savingMode}
            onSave={onSave}
            onCancelEdit={onCancelEdit}
          />
        </div>
      </div>

      {/* Recipients Modal */}
      <AnimatePresence>
        {showRecipientsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
            onClick={() => setShowRecipientsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-sky-300" />
                    Last Campaign Recipients - {msg.title}
                  </h3>
                  {recipientsStats && (
                    <p className="text-xs text-[#bdbdbd] mt-0.5">
                      {recipientsStats.total} total • {recipientsStats.successful} successful • {recipientsStats.failed} failed
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowRecipientsModal(false)}
                  className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-[#bdbdbd]" />
                </button>
              </div>

              {/* Stats Bar */}
              {recipientsStats && (
                <div className="px-4 py-2.5 border-b border-white/10 bg-white/5 flex gap-4 text-xs">
                  <div>
                    <p className="text-[#bdbdbd] mb-0.5">Total</p>
                    <p className="text-base font-bold text-white">{recipientsStats.total}</p>
                  </div>
                  <div>
                    <p className="text-[#bdbdbd] mb-0.5">Successful</p>
                    <p className="text-base font-bold text-lime-300">{recipientsStats.successful}</p>
                  </div>
                  {recipientsStats.failed > 0 && (
                    <div>
                      <p className="text-[#bdbdbd] mb-0.5">Failed</p>
                      <p className="text-base font-bold text-rose-300">{recipientsStats.failed}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Recipients List */}
              <div className="overflow-y-auto max-h-[calc(90vh-200px)] p-4">
                {recipients.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-10 h-10 text-[#bdbdbd] mx-auto mb-2 opacity-50" />
                    <p className="text-sm text-[#bdbdbd]">No recipients found</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {recipients.map((recipient, index) => (
                      <div
                        key={index}
                        className={`p-2.5 rounded-lg border transition-colors ${
                          recipient.is_sent
                            ? 'bg-lime-300/5 border-lime-300/20 hover:bg-lime-300/10'
                            : 'bg-rose-300/5 border-rose-300/20 hover:bg-rose-300/10'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {recipient.first_name && recipient.last_name ? (
                                <h4 className="font-semibold text-white text-sm truncate">
                                  {recipient.first_name} {recipient.last_name}
                                </h4>
                              ) : (
                                <h4 className="font-semibold text-[#bdbdbd] text-sm">Unknown Client</h4>
                              )}
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 ${
                                recipient.is_sent
                                  ? 'bg-lime-300/20 text-lime-300'
                                  : 'bg-rose-300/20 text-rose-300'
                              }`}>
                                {recipient.is_sent ? 'Sent' : 'Failed'}
                              </span>
                              {!recipient.is_sent && recipient.reason && (
                                <span className="flex items-center gap-1 text-[10px] text-rose-300">
                                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">{recipient.reason}</span>
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-[#bdbdbd] mt-0.5">
                              {recipient.phone_normalized}
                            </p>
                          </div>
                          <div className="flex-shrink-0">
                            {recipient.is_sent ? (
                              <CheckCircle className="w-4 h-4 text-lime-300" />
                            ) : (
                              <XCircle className="w-4 h-4 text-rose-300" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-white/10 px-4 py-3 bg-white/5">
                <button
                  onClick={() => setShowRecipientsModal(false)}
                  className="w-full px-4 py-2 rounded-lg font-semibold text-sm bg-white/10 text-white hover:bg-white/20 transition-all duration-300"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Next Send Banner - Only show if ACTIVE and not locked */}
      {msg.validationStatus === 'ACCEPTED' && msg.enabled && !isLocked && (
        <div className="bg-sky-300/10 border-t border-sky-300/20 px-6 py-3">
          <p className="text-xs text-sky-300 flex items-center gap-2">
            <Send className="w-3 h-3" />
            <span className="font-medium">Next send:</span>
            <span className="text-sky-200">{getNextSendDate()} at {msg.hour}:{msg.minute.toString().padStart(2, '0')} {msg.period}</span>
          </p>
        </div>
      )}
    </motion.div>
  );
}