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
      className={`panel overflow-visible ${
        isLocked ? '!border-amber-300/25' : ''
      }`}
    >
      {/* Locked Banner */}
      {isLocked && (
        <div className={`px-3 sm:px-5 py-2.5 flex items-center gap-2 rounded-t-xl ${
          campaignProgress?.is_finished 
            ? 'bg-sage/[0.07] border-b border-sage/20'
            : 'bg-amber-300/[0.06] border-b border-amber-300/15'
        }`}>
          <Lock strokeWidth={1.75} className={`w-4 h-4 flex-shrink-0 ${campaignProgress?.is_finished ? 'text-sage-bright' : 'text-amber-300'}`} />
          <p className={`text-[13px] font-medium ${campaignProgress?.is_finished ? 'text-sage-bright' : 'text-amber-300'}`}>
            {campaignProgress?.is_finished 
              ? 'Campaign Completed - This message cannot be edited or reused'
              : 'Campaign In Progress - Messages are being sent, editing is locked'
            }
          </p>
        </div>
      )}

      <div>
        {/* Header */}
        <div className="panel-header !px-3 sm:!px-5 flex-col !items-stretch sm:flex-row sm:!items-center">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${
              campaignProgress?.is_finished 
                ? 'bg-sage/10 border-sage/20 text-sage-bright'
                : campaignProgress?.is_active
                  ? 'bg-amber-300/[0.08] border-amber-300/20 text-amber-300'
                  : 'bg-raised border-white/[0.07] text-ivory'
            }`}>
              {campaignProgress?.is_finished ? (
                <CheckCircle className="w-4 h-4" strokeWidth={1.75} />
              ) : (
                <span className="font-semibold text-[13px] tabular-nums">{index + 1}</span>
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
                    className="field !h-8 !px-2 text-[13px]"
                    maxLength={30}
                    autoFocus
                    disabled={!msg.isEditing}
                  />
                  <button
                    onClick={() => onSaveTitle(msg.id)}
                    className="btn btn-ghost btn-sm !h-8 !w-8 !p-0 flex-shrink-0 !text-sage-bright"
                    disabled={!msg.isEditing}
                  >
                    <Check className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                  <button
                    onClick={onCancelEditTitle}
                    className="btn btn-ghost btn-sm !h-8 !w-8 !p-0 flex-shrink-0"
                  >
                    <X className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <h3 className="panel-title truncate">
                    {msg.title}
                  </h3>
                  {msg.isEditing && !isLocked && (
                    <button
                      onClick={() => onStartEditingTitle(msg.id, msg.title)}
                      className="p-1 rounded-md hover:bg-white/5 text-gray-500 hover:text-ivory transition-colors flex-shrink-0"
                    >
                      <Pencil className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </button>
                  )}
                </div>
              )}
              <p className="panel-subtitle flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.75} />
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
                  className="btn btn-glass btn-sm !h-8 !px-2.5 !gap-1.5 text-xs"
                >
                  {loadingPreview ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.75} />
                  ) : (
                    <Users className="w-3.5 h-3.5" strokeWidth={1.75} />
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
                className={`badge !py-1 transition-colors ${
                  msg.validationStatus === 'ACCEPTED'
                    ? 'badge-sage hover:bg-sage/20'
                    : ''
                }`}
              >
                <span className="hidden sm:inline">{msg.validationStatus === 'ACCEPTED' ? 'Active - Click to toggle' : 'Inactive'}</span>
                <span className="sm:hidden">{msg.validationStatus === 'ACCEPTED' ? 'Active' : 'Inactive'}</span>
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

            {/* Locked indicator */}
            {isLocked && !campaignProgress?.is_finished && (
              <div className="relative group">
                <div className="badge badge-warn !py-1">
                  <Lock className="w-3 h-3" strokeWidth={1.75} />
                  <span className="hidden sm:inline">Locked</span>
                </div>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none whitespace-nowrap">
                  <div className="bg-raised border border-white/[0.12] rounded-lg px-3 py-2 text-xs text-ivory">
                    Campaign is sending - cannot edit until complete
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                      <div className="border-4 border-transparent border-t-raised" />
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
                  className="btn btn-ghost btn-sm !h-8 !w-8 !p-0 flex-shrink-0 hover:!text-[#D99A8B]"
                >
                  <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                </button>
                <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-10 pointer-events-none whitespace-nowrap">
                  <div className="bg-raised border border-white/[0.12] rounded-lg px-3 py-2 text-xs text-ivory">
                    Delete this message permanently
                    <div className="absolute top-full right-4 -mt-1">
                      <div className="border-4 border-transparent border-t-raised" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-3 sm:p-5">
        {/* Mobile: Separate collapsible sections - Only show if not locked or if editing */}
        {(!isLocked || msg.isEditing) && (
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
            <div className="border border-white/[0.07] rounded-lg overflow-hidden">
              <button
                onClick={() => setShowScheduleSettings(!showScheduleSettings)}
                className="w-full p-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-sage" strokeWidth={1.75} />
                  <span className="font-semibold text-ivory text-sm">Schedule & Recipients</span>
                </div>
                {showScheduleSettings ? (
                  <ChevronUp className="w-4 h-4 text-gray-500" strokeWidth={1.75} />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" strokeWidth={1.75} />
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
                    <div className="p-3 border-t border-white/[0.07]">
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
                    <div className="p-3 sm:p-4 lg:p-6 border-t border-white/[0.07]">
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
          <div className="p-4 sm:p-5 bg-raised border border-white/[0.07] rounded-lg">
            <p className="field-label !mb-2">Message content</p>
            <p className="text-ivory text-sm leading-relaxed whitespace-pre-wrap">
              {msg.message}
            </p>
            {campaignProgress?.is_finished && (
              <div className="mt-4 pt-4 border-t border-white/[0.07]">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-xs text-muted">
                    This campaign has finished. You can delete this message or create a new one.
                  </p>
                  <button
                    onClick={fetchRecipients}
                    disabled={loadingRecipients}
                    className="btn btn-glass btn-sm text-xs sm:text-sm"
                  >
                    {loadingRecipients ? (
                      <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />
                    ) : (
                      <Users className="w-4 h-4" strokeWidth={1.75} />
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
      </div>

      {/* Recipients Modal */}
      <AnimatePresence>
        {showRecipientsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-backdrop !z-[70] flex items-center justify-center p-3 sm:p-4"
            onClick={() => setShowRecipientsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="modal-surface max-w-4xl w-full max-h-[90vh] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-white/[0.07]">
                <div className="min-w-0 flex-1 pr-2">
                  <h3 className="text-[15px] font-semibold text-ivory flex items-center gap-2 truncate">
                    <Users className="w-4 h-4 text-sage flex-shrink-0" strokeWidth={1.75} />
                    <span className="truncate">Campaign Recipients - {msg.title}</span>
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
                <div className="px-4 sm:px-5 py-3 border-b border-white/[0.07] flex gap-6">
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
              <div className="overflow-y-auto max-h-[calc(90vh-200px)] p-3 sm:p-4">
                {recipients.length === 0 ? (
                  <div className="empty-state">
                    <Users strokeWidth={1.75} />
                    <p>No recipients found</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {recipients.map((recipient, index) => (
                      <div
                        key={index}
                        className={`p-2 sm:p-2.5 rounded-lg border transition-colors ${
                          recipient.is_sent
                            ? 'bg-raised/60 border-white/[0.07] hover:bg-raised'
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
                                recipient.is_sent
                                  ? 'badge-sage'
                                  : 'badge-danger'
                              }`}>
                                {recipient.is_sent ? 'Sent' : 'Failed'}
                              </span>
                              {/* Failure Reason - Inline with tag */}
                              {!recipient.is_sent && recipient.reason && (
                                <span className="flex items-center gap-1 text-[11px] text-[#D99A8B]">
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
              <div className="border-t border-white/[0.07] px-4 sm:px-5 py-3 flex justify-end">
                <button
                  onClick={() => setShowRecipientsModal(false)}
                  className="btn btn-glass btn-sm"
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
            className="modal-backdrop flex items-center justify-center p-3 sm:p-4"
            onClick={() => setShowDeactivateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="modal-surface max-w-md w-full p-5 sm:p-6"
            >
              <div className="flex items-start gap-3 sm:gap-4 mb-3 sm:mb-4">
                <div className="w-10 h-10 rounded-lg bg-amber-300/[0.08] border border-amber-300/20 text-amber-300 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[15px] font-semibold text-ivory mb-1.5">
                    Deactivate Campaign?
                  </h3>
                  <p className="text-sm text-muted">
                    This will set your campaign to draft and refund{' '}
                    <span className="text-sage-bright font-semibold tabular-nums">{previewCount || 0} credits</span>{' '}
                    back to your available balance.
                  </p>
                </div>
              </div>

              <div className="p-3 sm:p-4 bg-amber-300/[0.06] border border-amber-300/15 rounded-lg mb-5">
                <div className="flex items-start gap-2 text-[13px] text-amber-300">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                  <div>
                    <p className="font-semibold mb-1">You'll need to reactivate</p>
                    <p className="text-amber-200/70">
                      Once deactivated, you'll need to verify and activate this message again before it can be sent.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowDeactivateModal(false)}
                  className="btn btn-ghost btn-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeactivate}
                  className="btn btn-primary btn-sm"
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
        <div className="border-t border-white/[0.07] px-3 sm:px-5 py-2.5">
          <p className="text-xs text-muted flex items-center gap-2">
            <Send className="w-3.5 h-3.5 flex-shrink-0 text-sage" strokeWidth={1.75} />
            <span className="font-medium text-ivory">Next send:</span>
            <span className="truncate">{getSchedulePreview(msg)}</span>
          </p>
        </div>
      )}
    </motion.div>
  );
}
