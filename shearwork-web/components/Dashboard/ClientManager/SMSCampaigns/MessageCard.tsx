import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Clock, CheckCircle, XCircle, Edit, Pencil, Check, X, Send, Loader2, Users, Lock, AlertCircle, ChevronDown, ChevronUp, MessageSquare, Calendar } from 'lucide-react';
import { SMSMessage } from './types';
import { MessageContent } from './MessageContent';
import { MessageSchedule } from './MessageSchedule';
import { supabase } from '@/utils/supabaseClient';
import { useState } from 'react';
import toast from 'react-hot-toast';

interface Recipient {
  phone_normalized: string;
  is_sent: boolean;
  reason: string | null;
  created_at: string;
  client_id: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface CampaignProgress {
  success: number;
  fail: number;
  total: number;
  expected: number;
  percentage: number;
  is_finished: boolean;
  is_active: boolean;
}

interface MessageCardProps {
  setLimitMode: any;
  maxClients: number;
  profile: any; 
  setAlgorithmType: (type: 'campaign' | 'mass') => void;
  availableCredits?: number;
  message: SMSMessage;
  index: number;
  isSaving: boolean;
  savingMode: 'draft' | 'activate' | null;
  validatingId: string | null;
  editingTitleId: string | null;
  tempTitle: string;
  previewCount?: number;
  loadingPreview: boolean;
  campaignProgress?: CampaignProgress;
  onLoadPreview: (limit: number) => void;
  onUpdate: (id: string, updates: Partial<SMSMessage>) => void;
  onRemove: (id: string) => void;
  onEnableEdit: (id: string) => void;
  onCancelEdit: (id: string) => void;
  onSave: (msgId: string, mode: 'draft' | 'activate') => void;
  onValidate: (msgId: string) => void;
  onRequestTest: (msgId: string) => void;
  onStartEditingTitle: (id: string, currentTitle: string) => void;
  onSaveTitle: (id: string) => void;
  onCancelEditTitle: () => void;
  onTempTitleChange: (title: string) => void;
}

export function MessageCard({
  setLimitMode,
  maxClients,
  profile,
  setAlgorithmType,
  availableCredits,
  message: msg,
  index,
  isSaving,
  savingMode,
  validatingId,
  editingTitleId,
  tempTitle,
  previewCount,
  loadingPreview,
  campaignProgress,
  onRequestTest,
  onLoadPreview,
  onUpdate,
  onRemove,
  onEnableEdit,
  onCancelEdit,
  onSave,
  onValidate,
  onStartEditingTitle,
  onSaveTitle,
  onCancelEditTitle,
  onTempTitleChange,
}: MessageCardProps) {
  
  const [showRecipientsModal, setShowRecipientsModal] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [recipientsStats, setRecipientsStats] = useState<{ total: number; successful: number; failed: number } | null>(null);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  
  // Mobile: separate controls for each section
  const [showMessageContent, setShowMessageContent] = useState(false);
  const [showScheduleSettings, setShowScheduleSettings] = useState(false);

  // Desktop: single control for both sections together
  const [showContent, setShowContent] = useState(true);

  const fetchRecipients = async () => {
    setLoadingRecipients(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const response = await fetch(`/api/client-messaging/get-campaign-recipients?messageId=${msg.id}&userId=${user.id}`);
      
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

  const handleDeactivate = async () => {
    setShowDeactivateModal(false);
    
    try {
      // First refund credits via onEnableEdit
      await onEnableEdit(msg.id);
      
      // Then save the DRAFT status to database
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const response = await fetch('/api/client-messaging/save-sms-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            id: msg.id,
            title: msg.title,
            message: msg.message,
            scheduleDate: msg.scheduleDate,
            clientLimit: msg.clientLimit,
            hour: msg.hour,
            minute: msg.minute,
            period: msg.period,
            scheduledFor: new Date(msg.scheduleDate + 'T00:00:00').toISOString(),
            validationStatus: 'DRAFT',
            isValidated: msg.isValidated,
            purpose: msg.purpose || 'campaign',
          }]
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save draft status');
      }

      toast.success('Campaign deactivated and set to draft');
    } catch (error) {
      console.error('Failed to deactivate:', error);
      toast.error('Failed to deactivate campaign');
    }
  };
  
  const getSchedulePreview = (msg: SMSMessage) => {
    const minute = msg.minute ?? 0;
    const displayHour = msg.hour === 0 ? 12 : msg.hour > 12 ? msg.hour - 12 : msg.hour;
    const timeStr = `${displayHour}:${minute.toString().padStart(2, '0')} ${msg.period || 'AM'}`;
    
    // Format the date
    if (msg.scheduleDate) {
      const date = new Date(msg.scheduleDate + 'T00:00:00'); // Prevent timezone issues
      const dateStr = date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
      return `Scheduled for ${dateStr} at ${timeStr}`;
    }
    
    // Fallback if no date is set
    return `Send at ${timeStr}`;
  };

  // Determine if message is locked
  const isLocked = campaignProgress?.is_active || campaignProgress?.is_finished;
  const canEdit = !isLocked && msg.isSaved && !msg.isEditing;
  const canDelete = true; // Can always delete

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className={`bg-white/5 backdrop-blur-lg border rounded-xl sm:rounded-2xl shadow-xl overflow-visible ${
        isLocked ? 'border-amber-300/30' : 'border-white/10'
      }`}
    >
      {/* Locked Banner */}
      {isLocked && (
        <div className={`px-3 sm:px-6 py-2 sm:py-3 flex items-center gap-2 ${
          campaignProgress?.is_finished 
            ? 'bg-lime-300/10 border-b border-lime-300/20'
            : 'bg-amber-300/10 border-b border-amber-300/20'
        }`}>
          <Lock className={`w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 ${campaignProgress?.is_finished ? 'text-lime-300' : 'text-amber-300'}`} />
          <p className={`text-xs sm:text-sm font-semibold ${campaignProgress?.is_finished ? 'text-lime-300' : 'text-amber-300'}`}>
            {campaignProgress?.is_finished 
              ? 'Campaign Completed - This message cannot be edited or reused'
              : 'Campaign In Progress - Messages are being sent, editing is locked'
            }
          </p>
        </div>
      )}

      <div className="p-3 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-3 sm:gap-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              campaignProgress?.is_finished 
                ? 'bg-lime-300/20 text-lime-300'
                : campaignProgress?.is_active
                  ? 'bg-amber-300/20 text-amber-300'
                  : 'bg-sky-300/20 text-sky-300'
            }`}>
              {campaignProgress?.is_finished ? (
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : (
                <span className="font-bold text-sm sm:text-base">{index + 1}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              {/* Editable Title */}
              {editingTitleId === msg.id ? (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <input
                    type="text"
                    value={tempTitle}
                    onChange={(e) => onTempTitleChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onSaveTitle(msg.id);
                      if (e.key === 'Escape') onCancelEditTitle();
                    }}
                    className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-sky-300/50 w-full"
                    maxLength={30}
                    autoFocus
                    disabled={!msg.isEditing}
                  />
                  <button
                    onClick={() => onSaveTitle(msg.id)}
                    className="p-1 rounded hover:bg-lime-300/20 text-lime-300 transition-all flex-shrink-0"
                    disabled={!msg.isEditing}
                  >
                    <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                  <button
                    onClick={onCancelEditTitle}
                    className="p-1 rounded hover:bg-rose-300/20 text-rose-300 transition-all flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <h3 className="text-white font-semibold text-sm sm:text-base truncate">
                    {msg.title}
                  </h3>
                  {msg.isEditing && !isLocked && (
                    <button
                      onClick={() => onStartEditingTitle(msg.id, msg.title)}
                      className="p-1 rounded hover:bg-white/10 text-[#bdbdbd] hover:text-white transition-all flex-shrink-0"
                    >
                      <Pencil className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    </button>
                  )}
                </div>
              )}
              <p className="text-[10px] sm:text-xs text-[#bdbdbd] flex items-center gap-1 mt-0.5">
                <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
                <span className="truncate">{getSchedulePreview(msg)}{msg.validationStatus !== 'ACCEPTED' ? ' | Inactive' : ''}</span>
              </p>
            </div>
          </div>
          
          {/* Status Cards */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {/* Preview Button with tooltip */}
            {!isLocked && (
              <div className="relative group">
                <button
                  onClick={() => onLoadPreview(Math.min(previewCount || msg.clientLimit, availableCredits || msg.clientLimit))}
                  disabled={loadingPreview}
                  className="px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-white/5 text-[#bdbdbd] border border-white/10 hover:bg-white/10 hover:text-sky-300 transition-all duration-300 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingPreview ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Users className="w-3 h-3" />
                  )}
                  <span className="hidden sm:inline">Who will receive this message?</span>
                  <span className="sm:hidden">Preview</span>
                </button>
              </div>
            )}

            {/* Edit Button with tooltip */}
            {canEdit && msg.validationStatus !== 'ACCEPTED' && (
              <div className="relative group">
                <button
                  onClick={() => onEnableEdit(msg.id)}
                  className="px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-white/5 text-[#bdbdbd] border border-white/10 hover:bg-white/10 hover:text-white transition-all duration-300 flex items-center gap-1"
                >
                  <Edit className="w-3 h-3" />
                  <span className="hidden sm:inline">Edit</span>
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
                  if (msg.validationStatus === 'ACCEPTED') {
                    setShowDeactivateModal(true);
                  } else {
                    toast.error('Please use the Activate button to schedule this message');
                  }
                }}
                className={`px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold transition-all ${
                  msg.validationStatus === 'ACCEPTED'
                    ? 'bg-lime-300/20 text-lime-300 border border-lime-300/30 hover:bg-lime-300/30'
                    : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                }`}
              >
                <span className="hidden sm:inline">{msg.validationStatus === 'ACCEPTED' ? 'Active - Click to toggle' : 'Inactive'}</span>
                <span className="sm:hidden">{msg.validationStatus === 'ACCEPTED' ? 'Active' : 'Inactive'}</span>
              </button>
            )}

            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Saved/Draft Badge */}
              <span className={`px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold ${
                msg.isSaved 
                  ? 'bg-lime-300/10 text-lime-300 border border-lime-300/20'
                  : 'bg-amber-300/10 text-amber-300 border border-amber-300/20'
              }`}>
                {msg.isSaved ? 'Saved' : 'Draft'}
              </span>

              {/* Verified Badge */}
              <span className={`px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold ${
                msg.isValidated
                  ? 'bg-sky-300/10 text-sky-300 border border-sky-300/20'
                  : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
              }`}>
                {msg.isValidated ? 'Verified' : 'Unverified'}
              </span>

            </div>

            {/* Locked indicator */}
            {isLocked && !campaignProgress?.is_finished && (
              <div className="relative group">
                <div className="px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-amber-300/10 text-amber-300 border border-amber-300/20 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  <span className="hidden sm:inline">Locked</span>
                </div>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none whitespace-nowrap">
                  <div className="bg-[#0a0a0a] border border-white/20 rounded-lg px-3 py-2 text-xs text-white shadow-xl">
                    Campaign is sending - cannot edit until complete
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                      <div className="border-4 border-transparent border-t-[#0a0a0a]" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Delete Button with tooltip */}
            {canDelete && (
              <div className="relative group">
                <button
                  onClick={() => onRemove(msg.id)}
                  className="p-1.5 sm:p-2 rounded-full bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all duration-300 flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-10 pointer-events-none whitespace-nowrap">
                  <div className="bg-[#0a0a0a] border border-white/20 rounded-lg px-3 py-2 text-xs text-white shadow-xl">
                    Delete this message permanently
                    <div className="absolute top-full right-4 -mt-1">
                      <div className="border-4 border-transparent border-t-[#0a0a0a]" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile: Separate collapsible sections - Only show if not locked or if editing */}
        {(!isLocked || msg.isEditing) && (
          <div className="sm:hidden space-y-3">
            {/* Message Content Section */}
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowMessageContent(!showMessageContent)}
                className="w-full p-3 flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-sky-300" />
                  <span className="font-semibold text-white text-sm">Message Content</span>
                </div>
                {showMessageContent ? (
                  <ChevronUp className="w-4 h-4 text-[#bdbdbd]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#bdbdbd]" />
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
                    <div className="p-3 border-t border-white/10">
                    <MessageContent
                      profile={profile}
                      message={msg}
                      validatingId={validatingId}
                      onUpdate={onUpdate}
                      onValidate={onValidate}
                      onRequestTest={onRequestTest}
                    />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Schedule Settings Section */}
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowScheduleSettings(!showScheduleSettings)}
                className="w-full p-3 flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-lime-300" />
                  <span className="font-semibold text-white text-sm">Schedule & Recipients</span>
                </div>
                {showScheduleSettings ? (
                  <ChevronUp className="w-4 h-4 text-[#bdbdbd]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#bdbdbd]" />
                )}
              </button>
              <AnimatePresence>
                {showScheduleSettings && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="p-3 border-t border-white/10">
                      <MessageSchedule
                        maxClients={maxClients}
                        setAlgorithmType={setAlgorithmType}
                        availableCredits={availableCredits}
                        message={msg}
                        isSaving={isSaving}
                        savingMode={savingMode}
                        previewCount={previewCount}
                        onUpdate={onUpdate}
                        onSave={onSave}
                        onCancelEdit={onCancelEdit}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Desktop: Single collapsible with grid inside - Only show if not locked or if editing */}
        {(!isLocked || msg.isEditing) && (
          <div className="hidden sm:block">
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowContent(!showContent)}
                className="w-full p-3 sm:p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white text-sm sm:text-base">Message Details</span>
                </div>
                {showContent ? (
                  <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-[#bdbdbd]" />
                ) : (
                  <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-[#bdbdbd]" />
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
                    <div className="p-3 sm:p-4 lg:p-6 border-t border-white/10">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                        {/* LEFT: Message Content (50%) */}
                          <MessageContent
                            profile={profile}
                            message={msg}
                            validatingId={validatingId}
                            onUpdate={onUpdate}
                            onValidate={onValidate}
                            onRequestTest={onRequestTest}
                          />

                        {/* RIGHT: Schedule Settings (50%) */}
                        <MessageSchedule
                          maxClients={maxClients}
                          setAlgorithmType={setAlgorithmType}
                          availableCredits={availableCredits}
                          message={msg}
                          isSaving={isSaving}
                          savingMode={savingMode}
                          previewCount={previewCount}
                          onUpdate={onUpdate}
                          onSave={onSave}
                          onCancelEdit={onCancelEdit}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Locked Message View */}
        {isLocked && !msg.isEditing && (
          <div className="p-4 sm:p-6 bg-white/5 border border-white/10 rounded-xl">
            <p className="text-xs sm:text-sm text-[#bdbdbd] mb-3 sm:mb-4">Message content:</p>
            <p className="text-white text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
              {msg.message}
            </p>
            {campaignProgress?.is_finished && (
              <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/10">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-[10px] sm:text-xs text-[#bdbdbd]">
                    This campaign has finished. You can delete this message or create a new one.
                  </p>
                  <button
                    onClick={fetchRecipients}
                    disabled={loadingRecipients}
                    className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-sky-300/10 border border-sky-300/20 text-sky-300 rounded-lg hover:bg-sky-300/20 transition-all duration-300 text-xs sm:text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingRecipients ? (
                      <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                    ) : (
                      <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    )}
                    <span className="hidden sm:inline">Who was it sent to?</span>
                    <span className="sm:hidden">Recipients</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recipients Modal */}
      <AnimatePresence>
        {showRecipientsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-2 sm:p-4"
            onClick={() => setShowRecipientsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1a1a1a] border border-white/10 rounded-xl sm:rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-3 sm:p-4 border-b border-white/10">
                <div className="min-w-0 flex-1 pr-2">
                  <h3 className="text-sm sm:text-lg font-bold text-white flex items-center gap-2 truncate">
                    <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-300 flex-shrink-0" />
                    <span className="truncate">Campaign Recipients - {msg.title}</span>
                  </h3>
                  {recipientsStats && (
                    <p className="text-[10px] sm:text-xs text-[#bdbdbd] mt-0.5">
                      {recipientsStats.total} total • {recipientsStats.successful} successful • {recipientsStats.failed} failed
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowRecipientsModal(false)}
                  className="p-1.5 hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
                >
                  <X className="w-4 h-4 text-[#bdbdbd]" />
                </button>
              </div>

              {/* Stats Bar */}
              {recipientsStats && (
                <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-white/10 bg-white/5 flex gap-3 sm:gap-4 text-[10px] sm:text-xs">
                  <div>
                    <p className="text-[#bdbdbd] mb-0.5">Total</p>
                    <p className="text-sm sm:text-base font-bold text-white">{recipientsStats.total}</p>
                  </div>
                  <div>
                    <p className="text-[#bdbdbd] mb-0.5">Successful</p>
                    <p className="text-sm sm:text-base font-bold text-lime-300">{recipientsStats.successful}</p>
                  </div>
                  {recipientsStats.failed > 0 && (
                    <div>
                      <p className="text-[#bdbdbd] mb-0.5">Failed</p>
                      <p className="text-sm sm:text-base font-bold text-rose-300">{recipientsStats.failed}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Recipients List */}
              <div className="overflow-y-auto max-h-[calc(90vh-200px)] p-3 sm:p-4">
                {recipients.length === 0 ? (
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
                              {/* Failure Reason - Inline with tag */}
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
              <div className="border-t border-white/10 px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5">
                <button
                  onClick={() => setShowRecipientsModal(false)}
                  className="w-full px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm bg-white/10 text-white hover:bg-white/20 transition-all duration-300"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Deactivate Confirmation Modal */}
      <AnimatePresence>
        {showDeactivateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-2 sm:p-4"
            onClick={() => setShowDeactivateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1a1a1a] border border-white/10 rounded-xl sm:rounded-2xl shadow-2xl max-w-md w-full p-4 sm:p-6"
            >
              <div className="flex items-start gap-3 sm:gap-4 mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-300/20 text-amber-300 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg sm:text-xl font-bold text-white mb-2">
                    Deactivate Campaign?
                  </h3>
                  <p className="text-xs sm:text-sm text-[#bdbdbd]">
                    This will set your campaign to draft and refund{' '}
                    <span className="text-lime-300 font-semibold">{previewCount || 0} credits</span>{' '}
                    back to your available balance.
                  </p>
                </div>
              </div>

              <div className="p-3 sm:p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-4 sm:mb-6">
                <div className="flex items-start gap-2 text-xs sm:text-sm text-amber-300">
                  <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">You'll need to reactivate</p>
                    <p className="text-amber-200/80">
                      Once deactivated, you'll need to verify and activate this message again before it can be sent.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 sm:gap-3">
                <button
                  onClick={() => setShowDeactivateModal(false)}
                  className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm bg-white/5 text-[#bdbdbd] hover:bg-white/10 hover:text-white transition-all duration-300 border border-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeactivate}
                  className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm bg-amber-300/20 text-amber-300 border border-amber-300/30 hover:bg-amber-300/30 transition-all duration-300"
                >
                  Deactivate & Refund
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview Banner - Only show if ACTIVE */}
      {msg.validationStatus === 'ACCEPTED' && !isLocked && (
        <div className="bg-sky-300/10 border-t border-sky-300/20 px-3 sm:px-6 py-2 sm:py-3">
          <p className="text-[10px] sm:text-xs text-sky-300 flex items-center gap-1.5 sm:gap-2">
            <Send className="w-3 h-3 flex-shrink-0" />
            <span className="font-medium">Next send:</span>
            <span className="text-sky-200 truncate">{getSchedulePreview(msg)}</span>
          </p>
        </div>
      )}
    </motion.div>
  );
}
