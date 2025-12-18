import { motion } from 'framer-motion';
import { Shield, AlertCircle, Send, Sparkles, MessageSquare } from 'lucide-react';
import { SMSMessage } from './types';
import { useState } from 'react';
import toast from 'react-hot-toast';

interface MessageContentProps {
  message: SMSMessage;
  validatingId: string | null;
  onUpdate: (id: string, updates: Partial<SMSMessage>) => void;
  onValidate: (msgId: string) => void;
}

export function MessageContent({
  message: msg,
  validatingId,
  onUpdate,
  onValidate,
}: MessageContentProps) {
  const [isTesting, setIsTesting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateTemplate = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/client-messaging/generate-sms-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: 'Generate a professional barbershop marketing SMS message with placeholders for customization'
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate template');
      }

      // Update the message with generated template
      onUpdate(msg.id, { message: data.message });
      toast.success('Template generated successfully!');
    } catch (error: any) {
      console.error('Template generation error:', error);
      toast.error(error.message || 'Failed to generate template');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTestMessage = async () => {
    // Check if message is saved
    if (!msg.isSaved) {
      toast.error('Please save the message as a draft before testing');
      return;
    }

    // Check if message is validated
    if (!msg.isValidated) {
      toast.error('Message must be validated before testing');
      return;
    }

    // Check if message is in DRAFT status (not activated)
    if (msg.validationStatus !== 'DRAFT') {
      toast.error('Only draft messages can be tested');
      return;
    }

    if (!msg.message.trim()) {
      toast.error('Please enter a message first');
      return;
    }

    if (msg.message.length < 100) {
      toast.error('Message must be at least 100 characters');
      return;
    }

    setIsTesting(true);
    try {
      const response = await fetch(`/api/client-messaging/qstash-sms-send?messageId=${msg.id}&action=test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send test message');
      }

      toast.success('Test message sent successfully to your phone!');
    } catch (error: any) {
      console.error('Test message error:', error);
      toast.error(error.message || 'Failed to send test message');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-medium text-[#bdbdbd] mb-1 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Message Content 

            {msg.isEditing && msg.isSaved && !msg.isValidated && (
              <div className="px-5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2">
                {/* <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" /> */}
                <p className="text-xs text-amber-300">
                  Validate this message to test or activate it
                </p>
              </div>
            )}

            {/* Test Requirements Info - Only show in edit mode */}
            {msg.isEditing && !msg.isSaved && (
              <div className="px-5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2">
                {/* <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" /> */}
                <p className="text-xs text-amber-300">
                  Save and validate this message as a draft to test it
                </p>
              </div>
            )}
          </label>
          <p className="text-xs text-[#bdbdbd]/70">
            {msg.isEditing ? 'Minimum Characters: 100 | Maximum Characters: 240' : 'Your configured marketing message'}
          </p>
        </div>
      </div>

      {/* Validation Reason Alert */}
      {msg.isValidated && msg.validationStatus === 'DENIED' && msg.validationReason && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-rose-300">{msg.validationReason}</p>
        </div>
      )}

      {/* Message Textarea */}
      <div className="relative">
        <textarea
          value={msg.message}
          onChange={(e) => onUpdate(msg.id, { message: e.target.value })}
          placeholder="Type your marketing message here or generate a template..."
          rows={12}
          disabled={!msg.isEditing}
          className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-20 text-white placeholder-[#bdbdbd]/50 focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300/50 transition-all resize-none scrollbar-hide ${
            !msg.isEditing ? 'cursor-default text-white/70' : ''
          }`}
          maxLength={240}
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
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

      {/* Action Buttons - Only show in edit mode */}
      {msg.isEditing && (
        <div className="grid grid-cols-3 gap-2">
          {/* Generate Template Button */}
          <button
            onClick={handleGenerateTemplate}
            disabled={isGenerating}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-500/20 border border-purple-500/30 text-purple-300 rounded-xl font-semibold text-sm hover:bg-purple-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Sparkles className="w-4 h-4" />
                </motion.div>
                <span className="hidden sm:inline">Generating...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline">Generate</span>
              </>
            )}
          </button>

          {/* Validate Button */}
          <button
            onClick={() => onValidate(msg.id)}
            disabled={msg.message.length < 100 || validatingId === msg.id}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl font-semibold text-sm hover:bg-white/10 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {validatingId === msg.id ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Shield className="w-4 h-4" />
                </motion.div>
                <span className="hidden sm:inline">Validating...</span>
              </>
            ) : (
              <>
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">Validate</span>
              </>
            )}
          </button>

          {/* Test Message Button */}
          <button
            onClick={handleTestMessage}
            disabled={
              !msg.isSaved || 
              !msg.isValidated ||
              msg.validationStatus !== 'DRAFT' ||
              msg.message.length < 100 || 
              isTesting
            }
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-300/20 border border-sky-300/30 text-sky-300 rounded-xl font-semibold text-sm hover:bg-sky-300/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTesting ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Send className="w-4 h-4" />
                </motion.div>
                <span className="hidden sm:inline">Sending...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Test</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Info Text - Only show when not editing */}
      {!msg.isEditing && (
        <div className="flex items-start gap-2 p-3 bg-lime-300/10 border border-lime-300/20 rounded-xl">
          <MessageSquare className="w-4 h-4 text-lime-300 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-lime-300">
            {msg.validationStatus === 'ACCEPTED' 
              ? 'This message is active and will be sent according to your schedule.'
              : 'This message is saved as a draft. Activate it to start sending.'}
          </p>
        </div>
      )}
    </div>
  );
}