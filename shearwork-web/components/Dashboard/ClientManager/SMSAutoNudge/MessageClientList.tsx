import { motion } from 'framer-motion';
import { NUDGING_PAUSED } from '@/lib/featureFlags'
import { Users, Loader2, FileText, Zap, Clock, AlertCircle, X } from 'lucide-react';
import { SMSMessage, PhoneNumber } from './types';

interface MessageClientListProps {
  message: SMSMessage;
  phoneNumbers: PhoneNumber[];
  isSaving: boolean;
  savingMode: 'draft' | 'activate' | null;
  onSave: (msgId: string, mode: 'draft' | 'activate') => void;
  onCancelEdit: (id: string) => void;
  isFullLock?: boolean;
  isPartialLock?: boolean;
  isTrialPreview?: boolean;
}

export function MessageClientList({
  message: msg,
  phoneNumbers,
  isSaving,
  savingMode,
  onSave,
  onCancelEdit,
  isFullLock = false,
  isPartialLock = false,
  isTrialPreview = false
}: MessageClientListProps) {
  
  
  // Format client data for textarea with aligned numbers
  const formatClientList = () => {
    if (phoneNumbers.length === 0) {
      return 'No clients selected for this category yet...';
    }
    
    // Find the max number width for alignment
    const maxNumberWidth = phoneNumbers.length.toString().length;
    return phoneNumbers
      .map((client, idx) => {
        const name = client.full_name || 'No name';
        const phone = client.phone_normalized || 'No phone';
        const number = (idx + 1).toString().padStart(maxNumberWidth, ' ');
        return `${number}. ${name}: ${phone}`;
      })
      .join('\n');
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <label className="field-label !mb-0 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" strokeWidth={1.75} />
            Recipients ({phoneNumbers.length} clients)
          </label>
        </div>
      </div>

      {/* Client List Textarea */}
      <div className="relative">
        <textarea
          value={formatClientList()}
          readOnly
          disabled
          rows={msg.isEditing ? 12 : 12}
          className="field !bg-white/[0.02] text-gray-300 text-xs sm:text-[13px] font-mono resize-none cursor-default scrollbar-hide"
          style={{ 
            caretColor: 'transparent',
            userSelect: 'text',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        />
        
        {/* Count Badge */}
        <span className="badge badge-sage absolute top-2 sm:top-2.5 right-2 sm:right-3 tabular-nums">
          {phoneNumbers.length}
        </span>
      </div>
      
      {/* Action Buttons */}
      {msg.isEditing && !isFullLock ? (
        <div className="mt-auto">
          {/* Two Choice Buttons */}
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
            {/* Save as Draft - Always available during editing (even partial lock) */}
            <button
              onClick={() => onSave(msg.id, 'draft')}
              disabled={isSaving || msg.message.length < 100}
className="btn btn-glass btn-sm w-full px-3 text-xs sm:text-sm"
            >
              {isSaving && savingMode === 'draft' ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Clock className="w-4 h-4" strokeWidth={1.75} />
                  </motion.div>
                  <span className="hidden xs:inline">Saving...</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" strokeWidth={1.75} />
                  <span className="hidden xs:inline">Save Draft</span>
                  <span className="xs:hidden">Draft</span>
                </>
              )}
            </button>

            {/* Activate Schedule - Disabled during partial lock with tooltip */}
            <div className="relative group">
              <button
                onClick={() => {
                  if (!isPartialLock && !isTrialPreview && !NUDGING_PAUSED) {
                    onSave(msg.id, 'activate');
                  }
                }}
                disabled={
                  isSaving ||
                  msg.message.length < 100 ||
                  !msg.isValidated ||
                  isPartialLock ||
                  isTrialPreview ||
                  NUDGING_PAUSED
                }
                className="btn btn-primary btn-sm w-full px-3 text-xs sm:text-sm"
              >
                {isSaving && savingMode === 'activate' ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <Clock className="w-4 h-4" strokeWidth={1.75} />
                    </motion.div>
                    <span className="hidden xs:inline">Activating...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" strokeWidth={1.75} />
                    <span className="hidden xs:inline">Activate</span>
                    <span className="xs:hidden">Activate</span>
                  </>
                )}
              </button>
              {(isPartialLock || isTrialPreview || NUDGING_PAUSED) && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none whitespace-nowrap">
                  <div className="bg-raised border border-white/[0.12] rounded-lg px-3 py-2 text-xs text-ivory">
                    {NUDGING_PAUSED ? 'Client nudging is paused for now' : isTrialPreview ? 'Activation available after upgrading' : 'Can be activated again next month'}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                      <div className="border-4 border-transparent border-t-raised" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Cancel Button */}
          {msg.isSaved && (
            <button
              onClick={() => onCancelEdit(msg.id)}
              disabled={isSaving}
              className="btn btn-ghost btn-sm w-full text-xs sm:text-sm"
            >
              <X className="w-4 h-4" strokeWidth={1.75} />
              Cancel
            </button>
          )}
        </div>
      ) : (
        // When NOT editing - show info text
        <div className="flex items-start gap-2 p-3 bg-white/[0.03] border border-white/[0.07] rounded-lg">
          <Users className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" strokeWidth={1.75} />
          <p className="text-xs text-muted">
            These clients are automatically selected based on their visit patterns and will receive your message when activated.
          </p>
        </div>
      )}
    </div>
  );
}
