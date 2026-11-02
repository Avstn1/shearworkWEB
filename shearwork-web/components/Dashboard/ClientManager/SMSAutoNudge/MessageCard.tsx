import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Clock, CheckCircle, XCircle, Edit, Pencil, Check, X, Send, Loader2, Users, Lock, AlertCircle, Calendar, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import { SMSMessage, PhoneNumber } from './types';
import { MessageContent } from './MessageContent';
import { supabase } from '@/utils/supabaseClient';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

import { MessageClientList } from './MessageClientList'
import { EmptyState } from '@/components/ui/AppKit'

interface Recipient {
  phone_normalized: string;
  is_sent: boolean;
  reason: string | null;
  created_at: string;
  client_id: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface AutoNudgeCampaignProgress {
  is_finished: boolean;
  is_running: boolean;
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
  isLocked?: boolean;
  autoNudgeCampaignProgress?: AutoNudgeCampaignProgress;
  isTrialPreview?: boolean;
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
  savingMode,
  validatingId,
  editingTitleId,
  tempTitle,
  phoneNumbers,
  isLocked = false,
  autoNudgeCampaignProgress,
  isTrialPreview = false,
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

  // Mobile: separate controls for each section
  const [showMessageContent, setShowMessageContent] = useState(false);
  const [showRecipients, setShowRecipients] = useState(false);

  // Desktop: single control for both sections together
  const [showContent, setShowContent] = useState(false);

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

      // Query sms_sent instead of sms_scheduled_messages
      const { data, error } = await supabase
        .from('sms_sent')
        .select('created_at')
        .eq('message_id', msg.id)
        .eq('user_id', user.id)
        .eq('purpose', 'client_sms')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
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
    
    if (currentDay >= (msg.dayOfMonth || 1)) { 
      targetMonth += 1;
      if (targetMonth > 11) {
        targetMonth = 0;
        targetYear += 1;
      }
    }
    
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

  // Determine lock states from campaign progress
  const isFullLock = autoNudgeCampaignProgress?.is_running || false;
  const isPartialLock = (autoNudgeCampaignProgress?.is_finished && !autoNudgeCampaignProgress?.is_running) || false;
  const isAnyLock = isFullLock || isPartialLock || isLocked;

  // Determine edit capabilities
  const canEdit = !isFullLock && msg.isSaved && !msg.isEditing; // Can edit if not full locked
  const canEditMessage = !isFullLock; // Message content is editable during partial lock

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className={`panel overflow-visible ${
        isFullLock ? '!border-[#D99A8B]/30' : isPartialLock ? '!border-amber-300/25' : ''
      }`}
    >
      {/* Full Lock Banner - Campaign in progress */}
      {isFullLock && (
        <div className="px-3 sm:px-5 py-2.5 flex items-center gap-2 rounded-t-xl bg-[#D99A8B]/[0.07] border-b border-[#D99A8B]/20">
          <Lock className="w-4 h-4 text-[#D99A8B] flex-shrink-0" strokeWidth={1.75} />
          <p className="text-[13px] font-medium text-[#D99A8B]">
            Campaign in progress - Locked until messaging completes
          </p>
        </div>
      )}

      {/* Partial Lock Banner - Campaign finished, can edit but not activate */}
      {isPartialLock && !isFullLock && (
        <div className="px-3 sm:px-5 py-2.5 flex items-start gap-2 rounded-t-xl bg-amber-300/[0.06] border-b border-amber-300/15">
          <Lock className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
          <p className="text-[13px] font-medium text-amber-300">
            <span className="hidden sm:inline">Campaign sent this month - You can edit and save as draft, but cannot activate until {getUnlockDate()}</span>
            <span className="sm:hidden">Sent this month - Can edit, unlocks {getUnlockDate()}</span>
          </p>
        </div>
      )}

      {/* Legacy Lock Banner - Fallback for old lock system */}
      {isLocked && !isFullLock && !isPartialLock && (
        <div className="px-3 sm:px-5 py-2.5 flex items-center gap-2 rounded-t-xl bg-amber-300/[0.06] border-b border-amber-300/15">
          <Lock className="w-4 h-4 text-amber-300 flex-shrink-0" strokeWidth={1.75} />
          <p className="text-[13px] font-medium text-amber-300">
            <span className="hidden sm:inline">Already sent this month - Message will unlock on {getUnlockDate()}</span>
            <span className="sm:hidden">Sent - Unlocks {getUnlockDate()}</span>
          </p>
        </div>
      )}

      <div>
        {/* Header */}
        <div className="panel-header !px-3 sm:!px-5 flex-col !items-stretch sm:flex-row sm:!items-center">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${
              msg.validationStatus === 'ACCEPTED' && msg.enabled
                ? 'bg-sage/10 border-sage/20 text-sage-bright'
                : isFullLock
                  ? 'bg-[#D99A8B]/[0.08] border-[#D99A8B]/20 text-[#D99A8B]'
                  : isPartialLock
                    ? 'bg-amber-300/[0.08] border-amber-300/20 text-amber-300'
                    : 'bg-raised border-white/[0.07] text-ivory'
            }`}>
              {msg.validationStatus === 'ACCEPTED' && msg.enabled ? (
                <CheckCircle className="w-4 h-4" strokeWidth={1.75} />
              ) : isFullLock || isPartialLock ? (
                <Lock className="w-4 h-4" strokeWidth={1.75} />
              ) : (
                <span className="font-semibold text-[13px] tabular-nums">{index + 1}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="panel-title truncate">
                {msg.title}
              </h3>
              <p className="panel-subtitle flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.75} />
                <span className="truncate">{getSchedulePreview()}</span>
                {msg.validationStatus !== 'ACCEPTED' || !msg.enabled ? ' | Inactive' : ''}
              </p>
            </div>
          </div>
          
          {/* Status Cards */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {/* View Recipients Button - Only show if message has been sent */}
            {lastSentDate && (
              <div className="relative group">
                <button
                  onClick={fetchRecipients}
                  disabled={loadingRecipients}
                  className="btn btn-glass btn-sm !h-8 !px-2.5 !gap-1.5 text-xs"
                >
                  {loadingRecipients ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.75} />
                  ) : (
                    <Users className="w-3.5 h-3.5" strokeWidth={1.75} />
                  )}
                  <span className="hidden sm:inline">Last Campaign</span>
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none whitespace-nowrap">
                  <div className="bg-raised border border-white/[0.12] rounded-lg px-3 py-2 text-xs text-ivory">
                    View last month&apos;s recipients
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                      <div className="border-4 border-transparent border-t-raised" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Edit Button - Can edit during partial lock */}
            {canEdit && msg.validationStatus !== 'ACCEPTED' && (
              <div className="relative group">
                <button
                  onClick={() => onEnableEdit?.(msg.id)}
                  className="btn btn-glass btn-sm !h-8 !px-2.5 !gap-1.5 text-xs"
                >
                  <Edit className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span className="hidden sm:inline">Edit</span>
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none whitespace-nowrap">
                  <div className="bg-raised border border-white/[0.12] rounded-lg px-3 py-2 text-xs text-ivory">
                    Edit this message
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                      <div className="border-4 border-transparent border-t-raised" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Active/Draft Toggle - Show during partial lock with special behavior */}
            {msg.isSaved && !isFullLock && (
              <button
                onClick={() => {
                  if (msg.validationStatus === 'ACCEPTED' && msg.enabled) {
                    onRequestDeactivate(msg.id);
                  } else if (!isPartialLock) {
                    toast.error('Please use the Activate button to schedule this message');
                  }
                }}
                className={`badge !py-1 transition-colors ${
                  msg.validationStatus === 'ACCEPTED' && msg.enabled
                    ? 'badge-sage hover:bg-sage/20'
                    : ''
                }`}
              >
                <span className="hidden sm:inline">{msg.validationStatus === 'ACCEPTED' && msg.enabled ? 'Active - Click to toggle' : 'Inactive'}</span>
                <span className="sm:hidden">{msg.validationStatus === 'ACCEPTED' && msg.enabled ? 'Active' : 'Inactive'}</span>
              </button>
            )}

            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Saved/Draft Badge */}
              <span className={`badge !py-1 ${
                msg.isSaved 
                  ? 'badge-sage'
                  : 'badge-warn'
              }`}>
                {msg.isSaved ? 'Saved' : 'Draft'}
              </span>

              {/* Verified Badge */}
              <span className={`badge !py-1 ${
                msg.isValidated
                  ? 'badge-info'
                  : ''
              }`}>
                {msg.isValidated ? 'Verified' : 'Unverified'}
              </span>
            </div>

            {/* Lock indicators */}
            {isFullLock && (
              <div className="relative group">
                <div className="badge badge-danger !py-1">
                  <Lock className="w-3 h-3" strokeWidth={1.75} />
                  <span className="hidden sm:inline">Sending</span>
                </div>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none whitespace-nowrap">
                  <div className="bg-raised border border-white/[0.12] rounded-lg px-3 py-2 text-xs text-ivory">
                    Campaign is currently sending messages
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                      <div className="border-4 border-transparent border-t-raised" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isPartialLock && !isFullLock && (
              <div className="relative group">
                <div className="badge badge-warn !py-1">
                  <Lock className="w-3 h-3" strokeWidth={1.75} />
                  <span className="hidden sm:inline">Partial Lock</span>
                </div>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none whitespace-nowrap">
                  <div className="bg-raised border border-white/[0.12] rounded-lg px-3 py-2 text-xs text-ivory">
                    Can edit and save as draft - unlocks {getUnlockDate()}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                      <div className="border-4 border-transparent border-t-raised" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-3 sm:p-5">
        {/* Last Sent Info */}
        {lastSentDate && (
          <div className="mb-4 sm:mb-5 p-3 bg-white/[0.02] border border-white/[0.07] rounded-lg">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-sage flex-shrink-0" strokeWidth={1.75} />
                <span className="text-[13px] font-medium text-ivory tabular-nums">
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
                <div className="flex items-center gap-1.5">
                  <span className="badge badge-sage tabular-nums">{recipientsStats.successful} sent</span>
                  {recipientsStats.failed > 0 && (
                    <span className="badge badge-danger tabular-nums">{recipientsStats.failed} failed</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mobile: Separate collapsible sections */}
        <div className="sm:hidden space-y-3">
          {/* Message Content Section */}
          <div className="border border-white/[0.07] rounded-lg overflow-hidden">
            <button
              onClick={() => setShowMessageContent(!showMessageContent)}
              className="w-full p-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-sage" strokeWidth={1.75} />
                <span className="font-semibold text-ivory text-sm">Message Content</span>
              </div>
              {showMessageContent ? (
                <ChevronUp className="w-4 h-4 text-gray-500" strokeWidth={1.75} />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-500" strokeWidth={1.75} />
              )}
            </button>
            <AnimatePresence>
              {showMessageContent && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="p-3 border-t border-white/[0.07]">
                    <MessageContent
                      message={msg}
                      validatingId={validatingId}
                      profile={profile}
                      onUpdate={onUpdate}
                      onValidate={onValidate}
                      onRequestTest={onRequestTest}
                      isTrialPreview={isTrialPreview}
                      isFullLock={isFullLock}
                      isPartialLock={isPartialLock}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Recipients Section */}
          <div className="border border-white/[0.07] rounded-lg overflow-hidden">
            <button
              onClick={() => setShowRecipients(!showRecipients)}
              className="w-full p-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-sage" strokeWidth={1.75} />
                <span className="font-semibold text-ivory text-sm">Recipients <span className="text-muted font-normal tabular-nums">({phoneNumbers.length})</span></span>
              </div>
              {showRecipients ? (
                <ChevronUp className="w-4 h-4 text-gray-500" strokeWidth={1.75} />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-500" strokeWidth={1.75} />
              )}
            </button>
            <AnimatePresence>
              {showRecipients && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="p-3 border-t border-white/[0.07]">
                    <MessageClientList
                      message={msg}
                      phoneNumbers={phoneNumbers}
                      isSaving={isSaving}
                      savingMode={savingMode}
                      onSave={onSave}
                      onCancelEdit={onCancelEdit}
                      isFullLock={isFullLock}
                      isPartialLock={isPartialLock}
                      isTrialPreview={isTrialPreview}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Desktop: Single collapsible with grid inside */}
        <div className="hidden sm:block">
          <div className="border border-white/[0.07] rounded-lg overflow-hidden">
            <button
              onClick={() => setShowContent(!showContent)}
              className="w-full p-3 sm:p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ivory text-sm">Message Details</span>
              </div>
              {showContent ? (
                <ChevronUp className="w-4 h-4 text-gray-500" strokeWidth={1.75} />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-500" strokeWidth={1.75} />
              )}
            </button>
            <AnimatePresence>
              {showContent && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 sm:p-5 border-t border-white/[0.07]">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                      {/* LEFT: Message Content (50%) */}
                      <MessageContent
                        message={msg}
                        validatingId={validatingId}
                        profile={profile}
                        onUpdate={onUpdate}
                        onValidate={onValidate}
                        onRequestTest={onRequestTest}
                        isTrialPreview={isTrialPreview}
                        isFullLock={isFullLock}
                        isPartialLock={isPartialLock}
                      />

                      {/* RIGHT: Recipients List (50%) */}
                      <MessageClientList
                        message={msg}
                        phoneNumbers={phoneNumbers}
                        isSaving={isSaving}
                        savingMode={savingMode}
                        onSave={onSave}
                        onCancelEdit={onCancelEdit}
                        isFullLock={isFullLock}
                        isPartialLock={isPartialLock}
                        isTrialPreview={isTrialPreview}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        </div>
      </div>

      {/* Recipients Modal */}
      <AnimatePresence>
        {showRecipientsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-backdrop !z-[70] flex items-center justify-center p-2 sm:p-4"
            onClick={() => setShowRecipientsModal(false)}
          >
            <motion.div
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="modal-surface max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-white/[0.07] flex-shrink-0">
                <div className="min-w-0 flex-1 pr-2">
                  <h3 className="text-[15px] font-semibold text-ivory flex items-center gap-2 truncate">
                    <Users className="w-4 h-4 text-sage flex-shrink-0" strokeWidth={1.75} />
                    <span className="truncate">Last Campaign Recipients - {msg.title}</span>
                  </h3>
                  {recipientsStats && (
                    <p className="text-xs text-muted mt-0.5 tabular-nums">
                      {recipientsStats.total} total • {recipientsStats.successful} successful • {recipientsStats.failed} failed
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowRecipientsModal(false)}
                  className="btn btn-ghost btn-sm !h-8 !w-8 !p-0 flex-shrink-0"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>

              {/* Stats Bar */}
              {recipientsStats && (
                <div className="px-4 sm:px-5 py-3 border-b border-white/[0.07] flex gap-6 flex-shrink-0">
                  <div>
                    <p className="stat-label mb-1">Total</p>
                    <p className="text-base font-semibold text-ivory tabular-nums">{recipientsStats.total}</p>
                  </div>
                  <div>
                    <p className="stat-label mb-1">Successful</p>
                    <p className="text-base font-semibold text-sage-bright tabular-nums">{recipientsStats.successful}</p>
                  </div>
                  {recipientsStats.failed > 0 && (
                    <div>
                      <p className="stat-label mb-1">Failed</p>
                      <p className="text-base font-semibold text-[#D99A8B] tabular-nums">{recipientsStats.failed}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Recipients List */}
              <div className="overflow-y-auto flex-1 min-h-0 p-3 sm:p-4">
                {recipients.length === 0 ? (
                  <EmptyState icon={Users} title="No recipients found" />
                ) : (
                  <div className="space-y-1.5">
                    {recipients.map((recipient, index) => (
                      <div
                        key={index}
                        className={`p-2.5 rounded-lg border transition-colors ${
                          recipient.is_sent
                            ? 'bg-white/[0.02] border-white/[0.07] hover:bg-white/[0.04]'
                            : 'bg-[#D99A8B]/[0.04] border-[#D99A8B]/15 hover:bg-[#D99A8B]/[0.07]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                              {recipient.first_name && recipient.last_name ? (
                                <h4 className="font-medium text-ivory text-[13px] truncate">
                                  {recipient.first_name} {recipient.last_name}
                                </h4>
                              ) : (
                                <h4 className="font-medium text-muted text-[13px]">Unknown Client</h4>
                              )}
                              <span className={`badge flex-shrink-0 ${
                                recipient.is_sent ? 'badge-sage' : 'badge-danger'
                              }`}>
                                {recipient.is_sent ? 'Sent' : 'Failed'}
                              </span>
                              {!recipient.is_sent && recipient.reason && (
                                <span className="flex items-center gap-1 text-[11px] text-[#D99A8B] min-w-0">
                                  <AlertCircle className="w-3 h-3 flex-shrink-0" strokeWidth={1.75} />
                                  <span className="truncate">{recipient.reason}</span>
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted mt-0.5 tabular-nums">
                              {recipient.phone_normalized}
                            </p>
                          </div>
                          <div className="flex-shrink-0">
                            {recipient.is_sent ? (
                              <CheckCircle className="w-4 h-4 text-sage" strokeWidth={1.75} />
                            ) : (
                              <XCircle className="w-4 h-4 text-[#D99A8B]" strokeWidth={1.75} />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end border-t border-white/[0.07] px-4 sm:px-5 py-3 flex-shrink-0">
                <button
                  onClick={() => setShowRecipientsModal(false)}
                  className="btn btn-glass btn-sm w-full sm:w-auto"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Next Send Banner - Only show if ACTIVE and not locked */}
      {msg.validationStatus === 'ACCEPTED' && msg.enabled && !isAnyLock && (
        <div className="border-t border-white/[0.07] px-3 sm:px-5 py-2.5">
          <p className="text-xs text-muted flex items-center gap-2">
            <Send className="w-3.5 h-3.5 flex-shrink-0 text-sage" strokeWidth={1.75} />
            <span className="font-medium text-ivory">Next send:</span>
            <span className="truncate tabular-nums">{getNextSendDate()} at {msg.hour}:{msg.minute.toString().padStart(2, '0')} {msg.period}</span>
          </p>
        </div>
      )}
    </motion.div>
  );
}
