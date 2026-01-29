import { motion } from 'framer-motion';
import { Shield, AlertCircle, Send, Sparkles } from 'lucide-react';
import { SMSMessage } from './types';
import { useState } from 'react';
import toast from 'react-hot-toast';

interface MessageContentProps {
  message: SMSMessage;
  validatingId: string | null;
  profile: any;
  onUpdate: (id: string, updates: Partial<SMSMessage>) => void;
  onValidate: (msgId: string) => void;
  onRequestTest: (msgId: string) => void;
  isTrialPreview?: boolean;
  isFullLock?: boolean;
  isPartialLock?: boolean;
}

export function MessageContent({
  profile,
  message: msg,
  validatingId,
  onUpdate,
  onValidate,
  onRequestTest, 
  isTrialPreview = false,
  isFullLock = false,
  isPartialLock = false,
}: MessageContentProps) {
  const [isTesting, setIsTesting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateTemplate = async () => {
    setIsGenerating(true);
    try {
      const bookingLink = `${process.env.NEXT_PUBLIC_SITE_URL}book?profile=${profile.username}`

      const response = await fetch('/api/client-messaging/generate-sms-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: 'Generate a professional barbershop marketing SMS message',
          profile: {
            full_name: profile?.full_name || '',
            email: profile?.email || '',
            phone: profile?.phone || '',
            booking_link: bookingLink
          }
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate template');
      }

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
    if (!msg.isSaved) {
      toast.error('Please save the message as a draft before testing');
      return;
    }

    if (!msg.isValidated) {
      toast.error('Message must be validated before testing');
      return;
    }

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
    <div className="space-y-3 sm:space-y-4 flex flex-col h-full">
      {/* Validation Reason Alert */}
      {msg.isValidated && msg.validationStatus === 'DENIED' && msg.validationReason && (
        <div className="p-2.5 sm:p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs sm:text-sm text-rose-300">{msg.validationReason}</p>
        </div>
      )}

      {/* Message Textarea */}
      <div className="flex-1">
        <label className="block text-xs sm:text-sm font-medium text-[#bdbdbd] mb-2">
          Message Content (SMS limits: 100-240 characters)
        </label>
        <div className="relative">
          <textarea
            value={msg.message}
            onChange={(e) =>
              onUpdate(msg.id, { message: e.target.value })
            }
            placeholder="Type your marketing message here or generate a template..."
            rows={9}
            disabled={!msg.isEditing || isFullLock}
            className={`w-full bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl px-3 sm:px-4 pb-12 sm:pb-15 -mb-3 py-2.5 sm:py-3 pr-16 sm:pr-20 text-xs sm:text-base text-white placeholder-[#bdbdbd]/50 focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300/50 transition-all resize-none overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent hover:scrollbar-thumb-white/30 ${
              !msg.isEditing || isFullLock ? 'cursor-not-allowed opacity-70' : ''
            }`}
            style={{ scrollbarWidth: 'thin' }}
            maxLength={240}
          />
          <span
            className={`absolute top-2 sm:top-3 right-2 sm:right-3 text-[10px] sm:text-xs font-medium ${
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

      {/* Test Requirements Info */}
      {!msg.isSaved && (
        <div className="p-2.5 sm:p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs sm:text-sm text-amber-300">
            Save and validate this message as a draft before you can test it
          </p>
        </div>
      )}

      {msg.isSaved && !msg.isValidated && (
        <div className="p-2.5 sm:p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs sm:text-sm text-amber-300">
            Validate this message before you can test it
          </p>
        </div>
      )}

      {/* Test Cost Info - Only show when saved AND validated */}
      {msg.isSaved && msg.isValidated && (
        <div className="p-2.5 sm:p-3 bg-sky-500/10 border border-sky-500/20 rounded-xl">
          <p className="text-xs sm:text-sm text-sky-300">
            Test messages cost 1 credit each once your free tests are used up.
          </p>
        </div>
      )}

      {/* Action Buttons */}
      {msg.isEditing && (
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {/* Generate Template Button */}
          <div className="relative group">
            <button
              onClick={handleGenerateTemplate}
              disabled={isGenerating || isFullLock}
              className="w-full flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 sm:py-2.5 bg-purple-500/20 border border-purple-500/30 text-purple-300 rounded-xl text-xs sm:text-base font-semibold hover:bg-purple-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                  </motion.div>
                  <span className="hidden sm:inline">Generating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Generate</span>
                </>
              )}
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none whitespace-nowrap">
              <div className="bg-[#0a0a0a] border border-white/20 rounded-lg px-3 py-2 text-xs text-white shadow-xl">
                AI-generate a message template
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                  <div className="border-4 border-transparent border-t-[#0a0a0a]" />
                </div>
              </div>
            </div>
          </div>

          {/* Validate Button */}
          <div className="relative group">
            <button
              onClick={() => onValidate(msg.id)}
              disabled={msg.message.length < 100 || validatingId === msg.id || isFullLock}
              className="w-full flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 sm:py-2.5 bg-white/5 border border-white/10 text-white rounded-xl text-xs sm:text-base font-semibold hover:bg-white/10 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {validatingId === msg.id ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
                  </motion.div>
                  <span className="hidden sm:inline">Validating...</span>
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Validate</span>
                </>
              )}
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none whitespace-nowrap">
              <div className="bg-[#0a0a0a] border border-white/20 rounded-lg px-3 py-2 text-xs text-white shadow-xl">
                Check message for compliance issues
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                  <div className="border-4 border-transparent border-t-[#0a0a0a]" />
                </div>
              </div>
            </div>
          </div>

          {/* Test Message Button */}
          <div className="relative group">
            <button
              onClick={() => {
                if (!msg.isSaved) {
                  toast.error('Please save the message as a draft before testing');
                  return;
                }
                if (!msg.isValidated) {
                  toast.error('Message must be validated before testing');
                  return;
                }
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
                if (isTrialPreview) {
                  toast.error('Auto-Nudge tests are available after upgrading');
                  return;
                }
                onRequestTest(msg.id);
              }}
              disabled={
                isTesting ||
                !msg.isSaved ||
                !msg.isValidated ||
                msg.validationStatus !== 'DRAFT' ||
                !msg.message.trim() ||
                msg.message.length < 100 ||
                isFullLock ||
                isTrialPreview
              }
              className={`w-full flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-base font-semibold transition-all duration-300 ${
                isTesting ||
                !msg.isSaved ||
                !msg.isValidated ||
                msg.validationStatus !== 'DRAFT' ||
                !msg.message.trim() ||
                msg.message.length < 100 ||
                isFullLock ||
                isTrialPreview
                  ? 'bg-gray-600/50 text-gray-400 cursor-not-allowed border border-gray-600/50'
                  : 'bg-sky-300/20 border border-sky-300/30 text-sky-300 hover:bg-sky-300/30'
              }`}
            >
              {isTesting ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                  </motion.div>
                  <span className="hidden sm:inline">Sending...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Test</span>
                </>
              )}
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none whitespace-nowrap">
              <div className="bg-[#0a0a0a] border border-white/20 rounded-lg px-3 py-2 text-xs text-white shadow-xl">
                Send test to your phone (1 credit)
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                  <div className="border-4 border-transparent border-t-[#0a0a0a]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
