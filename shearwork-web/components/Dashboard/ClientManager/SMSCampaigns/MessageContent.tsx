import { motion } from 'framer-motion';
import { Shield, AlertCircle, Send, Sparkles } from 'lucide-react';
import { SMSMessage } from './types';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '@/utils/supabaseClient';

interface MessageContentProps {
  profile: any;
  message: SMSMessage;
  validatingId: string | null;
  testMessagesUsed: number;
  onUpdate: (id: string, updates: Partial<SMSMessage>) => void;
  onValidate: (msgId: string) => void;
  onRequestTest: (msgId: string) => void;
}

export function MessageContent({
  profile,
  message: msg,
  validatingId,
  testMessagesUsed,
  onUpdate,
  onValidate,
  onRequestTest, 
}: MessageContentProps) {
  const [isTesting, setIsTesting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [testsUsedToday, setTestsUsedToday] = useState(0);
  const DAILY_TEST_LIMIT = 10;

  // Load test count on mount
  useEffect(() => {
    loadTestCount();
  }, []);

  const loadTestCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get start of today in user's timezone
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count, error } = await supabase
        .from('sms_sent')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('purpose', 'test_message')
        .eq('is_sent', true)
        .gte('created_at', today.toISOString());

      if (error) throw error;
      setTestsUsedToday(count || 0);
    } catch (error) {
      console.error('Failed to load test count:', error);
    }
  };

  const handleGenerateTemplate = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/client-messaging/generate-sms-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: 'Generate a professional barbershop marketing SMS message with placeholders for customization',
          profile: {
            full_name: profile?.full_name || '',
            email: profile?.email || '',
            phone: profile?.phone || '',
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
    <div className="space-y-4 flex flex-col h-full">
      {/* Validation Reason Alert */}
      {msg.isValidated && msg.validationStatus === 'DENIED' && msg.validationReason && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-rose-300">{msg.validationReason}</p>
        </div>
      )}

      {/* Message Textarea */}
      <div className="flex-1">
        <label className="block text-sm font-medium text-[#bdbdbd] mb-2">
          Message Content (SMS limits: 100-240 characters)
        </label>
        <div className="relative">
          <textarea
            value={msg.message}
            onChange={(e) =>
              onUpdate(msg.id, { message: e.target.value })
            }
            placeholder="Type your marketing message here or generate a template..."
            rows={11}
            disabled={!msg.isEditing}
            className={`w-full bg-white/5 border border-white/10 rounded-2xl px-4 pb-15 -mb-3 py-3 pr-20 text-white placeholder-[#bdbdbd]/50 focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300/50 transition-all resize-none overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent hover:scrollbar-thumb-white/30 ${
              !msg.isEditing ? 'cursor-not-allowed opacity-70' : ''
            }`}
            style={{ scrollbarWidth: 'thin' }}
            maxLength={240}
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
      </div>

            {/* Test Requirements Info */}
      {!msg.isSaved && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-300">
            Save and validate this message as a draft before you can test it
          </p>
        </div>
      )}

      {msg.isSaved && !msg.isValidated && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-300">
            Validate this message before you can test it
          </p>
        </div>
      )}

      {/* Test Limit Info */}
      {msg.isSaved && msg.isValidated && msg.validationStatus === 'DRAFT' && (
        <div className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-xl">
          <p className="text-sm text-sky-300">
            {testsUsedToday >= DAILY_TEST_LIMIT ? (
              <>
                You've used all {DAILY_TEST_LIMIT} free tests today. Additional tests cost 1 credit each.
              </>
            ) : (
              <>
                Free tests remaining today: <span className="font-semibold">{DAILY_TEST_LIMIT - testsUsedToday}/{DAILY_TEST_LIMIT}</span>
              </>
            )}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      {msg.isEditing && (
        <div className="grid grid-cols-3 gap-2">
          {/* Generate Template Button */}
          <div className="relative group">
            <button
              onClick={handleGenerateTemplate}
              disabled={isGenerating}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-500/20 border border-purple-500/30 text-purple-300 rounded-xl font-semibold hover:bg-purple-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Sparkles className="w-5 h-5" />
                  </motion.div>
                  <span className="hidden sm:inline">Generating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
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
              disabled={msg.message.length < 100 || validatingId === msg.id}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl font-semibold hover:bg-white/10 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {validatingId === msg.id ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Shield className="w-5 h-5" />
                  </motion.div>
                  <span className="hidden sm:inline">Validating...</span>
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5" />
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
                onRequestTest(msg.id);
              }}
              disabled={isTesting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-300/20 border border-sky-300/30 text-sky-300 rounded-xl font-semibold hover:bg-sky-300/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isTesting ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Send className="w-5 h-5" />
                  </motion.div>
                  <span className="hidden sm:inline">Sending...</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span className="hidden sm:inline">Test</span>
                </>
              )}
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none whitespace-nowrap">
              <div className="bg-[#0a0a0a] border border-white/20 rounded-lg px-3 py-2 text-xs text-white shadow-xl">
                {testMessagesUsed >= 10 
                  ? 'Send test to your phone (1 credit)' 
                  : `Send test to your phone (${10 - testMessagesUsed} free left)`
                }
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