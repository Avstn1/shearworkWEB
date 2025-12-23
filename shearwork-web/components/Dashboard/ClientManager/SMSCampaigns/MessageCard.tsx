import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Clock, CheckCircle, XCircle, Edit, Pencil, Check, X, Send, Loader2, Users, Lock, AlertCircle } from 'lucide-react';
import { SMSMessage } from './types';
import { MessageContent } from './MessageContent';
import { MessageSchedule } from './MessageSchedule';
import { supabase } from '@/utils/supabaseClient';
import { useState } from 'react';

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
  testMessagesUsed: number; 
  campaignProgress?: CampaignProgress;
  onLoadPreview: (limit: number) => void;
  onUpdate: (id: string, updates: Partial<SMSMessage>) => void;
  onRemove: (id: string) => void;
  onEnableEdit: (id: string) => void;
  onCancelEdit: (id: string) => void;
  onSave: (msgId: string, mode: 'draft' | 'activate') => void;
  onValidate: (msgId: string) => void;
  onRequestTest: (msgId: string) => void;
  onTestComplete: () => void;
  onStartEditingTitle: (id: string, currentTitle: string) => void;
  onSaveTitle: (id: string) => void;
  onCancelEditTitle: () => void;
  onTempTitleChange: (title: string) => void;
}

export function MessageCard({
  profile,
  setAlgorithmType,
  availableCredits,
  message: msg,
  index,
  isSaving,
  testMessagesUsed,
  savingMode,
  validatingId,
  editingTitleId,
  tempTitle,
  previewCount,
  loadingPreview,
  campaignProgress,
  onRequestTest,
  onTestComplete,
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
      className={`bg-white/5 backdrop-blur-lg border rounded-2xl shadow-xl overflow-hidden ${
        isLocked ? 'border-amber-300/30' : 'border-white/10'
      }`}
    >
      {/* Locked Banner */}
      {isLocked && (
        <div className={`px-6 py-3 flex items-center gap-2 ${
          campaignProgress?.is_finished 
            ? 'bg-lime-300/10 border-b border-lime-300/20'
            : 'bg-amber-300/10 border-b border-amber-300/20'
        }`}>
          <Lock className={`w-4 h-4 ${campaignProgress?.is_finished ? 'text-lime-300' : 'text-amber-300'}`} />
          <p className={`text-sm font-semibold ${campaignProgress?.is_finished ? 'text-lime-300' : 'text-amber-300'}`}>
            {campaignProgress?.is_finished 
              ? 'Campaign Completed - This message cannot be edited or reused'
              : 'Campaign In Progress - Messages are being sent, editing is locked'
            }
          </p>
        </div>
      )}

      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              campaignProgress?.is_finished 
                ? 'bg-lime-300/20 text-lime-300'
                : campaignProgress?.is_active
                  ? 'bg-amber-300/20 text-amber-300'
                  : 'bg-sky-300/20 text-sky-300'
            }`}>
              {campaignProgress?.is_finished ? (
                <CheckCircle className="w-5 h-5" />
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
                    maxLength={30}
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
                <Clock className="w-3 h-3" />
                {getSchedulePreview(msg)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Preview Button with tooltip */}
            {!isLocked && (
              <div className="relative group">
                <button
                  onClick={() => onLoadPreview(msg.clientLimit)}
                  disabled={loadingPreview}
                  className="px-3 py-1 rounded-full text-xs font-semibold bg-white/5 text-[#bdbdbd] border border-white/10 hover:bg-white/10 hover:text-sky-300 transition-all duration-300 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingPreview ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Users className="w-3 h-3" />
                  )}
                  Preview
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none whitespace-nowrap">
                  <div className="bg-[#0a0a0a] border border-white/20 rounded-lg px-3 py-2 text-xs text-white shadow-xl">
                    View which clients will receive this message
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                      <div className="border-4 border-transparent border-t-[#0a0a0a]" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Edit Button with tooltip */}
            {canEdit && (
              <div className="relative group">
                <button
                  onClick={() => onEnableEdit(msg.id)}
                  className="px-3 py-1 rounded-full text-xs font-semibold bg-white/5 text-[#bdbdbd] border border-white/10 hover:bg-white/10 hover:text-white transition-all duration-300 flex items-center gap-1"
                >
                  <Edit className="w-3 h-3" />
                  Edit
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none whitespace-nowrap">
                  <div className="bg-[#0a0a0a] border border-white/20 rounded-lg px-3 py-2 text-xs text-white shadow-xl">
                    {msg.validationStatus === 'ACCEPTED' ? 'Edit message (will refund reserved credits)' : 'Edit this message'}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                      <div className="border-4 border-transparent border-t-[#0a0a0a]" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Locked indicator */}
            {isLocked && !campaignProgress?.is_finished && (
              <div className="relative group">
                <div className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-300/10 text-amber-300 border border-amber-300/20 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Locked
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
                  className="p-2 rounded-full bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all duration-300"
                >
                  <Trash2 className="w-4 h-4" />
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

        {/* Progress Bar */}
        {campaignProgress && (campaignProgress.is_active || campaignProgress.is_finished) && (
          <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">
                  {campaignProgress.is_finished ? 'Campaign Complete' : 'Sending Progress'}
                </span>
                {!campaignProgress.is_finished && (
                  <Loader2 className="w-4 h-4 text-sky-300 animate-spin" />
                )}
              </div>
              <span className="text-sm font-bold text-white">
                {campaignProgress.total} / {campaignProgress.expected}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="relative h-3 bg-white/10 rounded-full overflow-hidden mb-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${campaignProgress.percentage}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className={`h-full rounded-full ${
                  campaignProgress.is_finished 
                    ? 'bg-gradient-to-r from-lime-300 to-green-400'
                    : 'bg-gradient-to-r from-sky-300 to-blue-400'
                }`}
              />
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-lime-300" />
                <span className="text-lime-300 font-semibold">{campaignProgress.success} successful</span>
              </div>
              {campaignProgress.fail > 0 && (
                <div className="flex items-center gap-1">
                  <XCircle className="w-3 h-3 text-rose-300" />
                  <span className="text-rose-300 font-semibold">{campaignProgress.fail} failed</span>
                </div>
              )}
              <div className="flex items-center gap-1 text-[#bdbdbd]">
                <span>{campaignProgress.percentage}% complete</span>
              </div>
            </div>
          </div>
        )}

        {/* 50/50 Split Layout - Only show if not locked or if editing */}
        {(!isLocked || msg.isEditing) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT: Message Content (50%) */}
            <MessageContent
              profile={profile}
              message={msg}
              validatingId={validatingId}
              testMessagesUsed={testMessagesUsed} 
              onUpdate={onUpdate}
              onValidate={onValidate}
              onRequestTest={onRequestTest} 
            />

            {/* RIGHT: Schedule Settings (50%) */}
            <MessageSchedule
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
        )}

        {/* Locked Message View */}
        {isLocked && !msg.isEditing && (
          <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
            <p className="text-sm text-[#bdbdbd] mb-4">Message content:</p>
            <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
              {msg.message}
            </p>
            {campaignProgress?.is_finished && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-xs text-[#bdbdbd]">
                  This campaign has finished. You can delete this message or create a new one.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preview Banner */}
      {!isLocked && (
        <div className="bg-sky-300/10 border-t border-sky-300/20 px-6 py-3">
          <p className="text-xs text-sky-300 flex items-center gap-2">
            <Send className="w-3 h-3" />
            <span className="font-medium">Next send:</span>
            <span className="text-sky-200">{getSchedulePreview(msg)}</span>
          </p>
        </div>
      )}
    </motion.div>
  );
}