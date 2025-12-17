import { motion } from 'framer-motion';
import { Trash2, Clock, CheckCircle, XCircle, Edit, Pencil, Check, X, Send } from 'lucide-react';
import { SMSMessage, DAYS_OF_WEEK } from './types';
import { MessageContent } from './MessageContent';
import { MessageSchedule } from './MessageSchedule';

interface PhoneNumber {
  first_name: string | null;
  last_name: string | null;
  phone_normalized: string | null;
}

interface MessageCardProps {
  message: SMSMessage;
  index: number;
  isSaving: boolean;
  savingMode: 'draft' | 'activate' | null;
  validatingId: string | null;
  editingTitleId: string | null;
  tempTitle: string;
  phoneNumbers: PhoneNumber[];
  onUpdate: (id: string, updates: Partial<SMSMessage>) => void;
  onRemove: (id: string) => void;
  onEnableEdit: (id: string) => void;
  onCancelEdit: (id: string) => void;
  onSave: (msgId: string, mode: 'draft' | 'activate') => void;
  onValidate: (msgId: string) => void;
  onStartEditingTitle: (id: string, currentTitle: string) => void;
  onSaveTitle: (id: string) => void;
  onCancelEditTitle: () => void;
  onTempTitleChange: (title: string) => void;
}

export function MessageCard({
  message: msg,
  index,
  isSaving,
  savingMode,
  validatingId,
  editingTitleId,
  tempTitle,
  phoneNumbers,
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

  return (
    <motion.div
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
                  {msg.isEditing && (
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
            {/* Edit Button (only show if not editing and message is saved) */}
            {!msg.isEditing && msg.isSaved && (
              <button
                onClick={() => onEnableEdit(msg.id)}
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
                    onUpdate(msg.id, { enabled: !msg.enabled })
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
                <>
                  <div className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-300/20 text-amber-300 border border-amber-300/30">
                    Draft
                  </div>
                  <div className="px-3 py-1 rounded-full text-xs font-semibold bg-lime-300/20 text-lime-300 border border-lime-300/30 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Saved
                  </div>
                </>
              )
            ) : (
              <>
                <div className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-300/20 text-amber-300 border border-amber-300/30">
                  Draft
                </div>
                <div className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-300/20 text-rose-300 border border-rose-300/30 flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  Not Saved
                </div>
              </>
            )}

            {/* Delete Button */}
            <button
              onClick={() => onRemove(msg.id)}
              className="p-2 rounded-full bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all duration-300"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 50/50 Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: Message Content (50%) */}
          <MessageContent
            message={msg}
            validatingId={validatingId}
            onUpdate={onUpdate}
            onValidate={onValidate}
          />

          {/* RIGHT: Recipients (50%) */}
          <MessageSchedule
            message={msg}
            phoneNumbers={phoneNumbers}
          />
        </div>
      </div>

      {/* Preview Banner */}
      <div className="bg-sky-300/10 border-t border-sky-300/20 px-6 py-3">
        <p className="text-xs text-sky-300 flex items-center gap-2">
          <Send className="w-3 h-3" />
          <span className="font-medium">Will send to:</span>
          <span className="text-sky-200">{phoneNumbers.length} {msg.visitingType} clients</span>
        </p>
      </div>
    </motion.div>
  );
}