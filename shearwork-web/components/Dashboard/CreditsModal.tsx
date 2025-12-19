'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Coins, History, ShoppingCart, Zap, Clock, Check, Sparkles, Loader2, Lock, Gem, Crown, Star } from 'lucide-react';
import { supabase } from '@/utils/supabaseClient';

type CreditView = 'balance' | 'history' | 'purchase';

interface CreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CREDIT_PACKAGES = [
  {
    amount: 100,
    price: 6.50,
    popular: false,
    icon: Coins,
  },
  {
    amount: 250,
    price: 14.50,
    popular: false,
    savings: '11% off',
    icon: Star,
  },
  {
    amount: 500,
    price: 27.50,
    popular: false,
    savings: '15% off',
    icon: Gem,
  },
  {
    amount: 1000,
    price: 50,
    popular: true,
    savings: '23% off',
    icon: Crown,
  },
];

export default function CreditsModal({
  isOpen,
  onClose,
}: CreditsModalProps) {
  const [activeView, setActiveView] = useState<CreditView>('balance');
  const [availableCredits, setAvailableCredits] = useState<number>(0);
  const [reservedCredits, setReservedCredits] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchCredits();
    }
  }, [isOpen]);

  const fetchCredits = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('No user found');
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('available_credits, reserved_credits')
        .eq('user_id', user.id)
        .single();

      console.log('Fetched profile:', profile);

      if (error) {
        console.error('Error fetching credits:', error);
        return;
      }

      if (profile) {
        setAvailableCredits(profile.available_credits || 0);
        setReservedCredits(profile.reserved_credits || 0);
      }
    } catch (error) {
      console.error('Error in fetchCredits:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Coins className="w-6 h-6 text-lime-300" />
                Credits Manager
              </h2>
              <p className="text-sm text-[#bdbdbd] mt-1">
                Manage your credits for SMS campaigns and premium features
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-[#bdbdbd]" />
            </button>
          </div>

          {/* View Switcher */}
          <div className="p-6 border-b border-white/10">
            <div className="flex gap-1 bg-[#0a0a0a] rounded-full p-1">
              <button
                onClick={() => setActiveView('balance')}
                className={`flex-1 px-6 py-3 rounded-full text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                  activeView === 'balance'
                    ? 'bg-lime-300 text-black shadow-[0_0_12px_#c4ff85]'
                    : 'text-[#bdbdbd] hover:text-white hover:bg-[#2a2a2a]'
                }`}
              >
                <Coins className="w-4 h-4" />
                Balance
              </button>
              <button
                onClick={() => setActiveView('history')}
                className={`flex-1 px-6 py-3 rounded-full text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                  activeView === 'history'
                    ? 'bg-lime-300 text-black shadow-[0_0_12px_#c4ff85]'
                    : 'text-[#bdbdbd] hover:text-white hover:bg-[#2a2a2a]'
                }`}
              >
                <History className="w-4 h-4" />
                History
              </button>
              <button
                onClick={() => setActiveView('purchase')}
                className={`flex-1 px-6 py-3 rounded-full text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                  activeView === 'purchase'
                    ? 'bg-lime-300 text-black shadow-[0_0_12px_#c4ff85]'
                    : 'text-[#bdbdbd] hover:text-white hover:bg-[#2a2a2a]'
                }`}
              >
                <ShoppingCart className="w-4 h-4" />
                Buy Credits
              </button>
            </div>
          </div>

          {/* Content */}
          <div className={`p-6 ${activeView === 'purchase' ? '' : 'overflow-y-auto max-h-[calc(85vh-240px)]'}`}>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-lime-300 animate-spin" />
              </div>
            ) : (
              <AnimatePresence mode="wait">
                {/* BALANCE VIEW */}
                {activeView === 'balance' && (
                  <motion.div
                    key="balance"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6"
                  >
                    {/* Credit Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Available Credits */}
                      <div className="relative overflow-hidden bg-gradient-to-br from-lime-300/20 to-green-500/10 border border-lime-300/30 rounded-2xl p-6">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-lime-300/10 rounded-full blur-3xl" />
                        <div className="relative">
                          <div className="flex items-center gap-2 mb-2">
                            <Coins className="w-5 h-5 text-lime-300" />
                            <span className="text-sm font-medium text-lime-300">Available Credits</span>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-bold text-white">{availableCredits.toLocaleString()}</span>
                            <span className="text-lg text-lime-300">credits</span>
                          </div>
                          <p className="text-xs text-[#bdbdbd] mt-3">
                            Ready to use for SMS campaigns and premium features
                          </p>
                        </div>
                      </div>

                      {/* Reserved Credits */}
                      <div className="relative overflow-hidden bg-gradient-to-br from-amber-300/20 to-orange-500/10 border border-amber-300/30 rounded-2xl p-6">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-300/10 rounded-full blur-3xl" />
                        <div className="relative">
                          <div className="flex items-center gap-2 mb-2">
                            <Lock className="w-5 h-5 text-amber-300" />
                            <span className="text-sm font-medium text-amber-300">Reserved Credits</span>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-bold text-white">{reservedCredits.toLocaleString()}</span>
                            <span className="text-lg text-amber-300">credits</span>
                          </div>
                          <p className="text-xs text-[#bdbdbd] mt-3">
                            Allocated for scheduled messages
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Total Balance */}
                    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-[#bdbdbd] mb-1">Total Balance</p>
                          <p className="text-3xl font-bold text-white">
                            {(availableCredits + reservedCredits).toLocaleString()} credits
                          </p>
                        </div>
                        <button
                          onClick={() => setActiveView('purchase')}
                          className="px-6 py-3 bg-lime-300 text-black rounded-full font-semibold hover:bg-lime-400 transition-all duration-300 shadow-[0_0_12px_rgba(196,255,133,0.4)] hover:shadow-[0_0_16px_rgba(196,255,133,0.6)]"
                        >
                          Buy More Credits
                        </button>
                      </div>
                    </div>

                    {/* Usage Info */}
                    <div className="bg-sky-300/10 border border-sky-300/20 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <Zap className="w-5 h-5 text-sky-300 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="text-sm font-semibold text-sky-300 mb-1">How Credits Work</h4>
                          <p className="text-xs text-[#bdbdbd] leading-relaxed">
                            Credits are used for SMS campaigns, premium analytics, and advanced features. 
                            Each SMS message costs 1 credit. Reserved credits are allocated for your scheduled messages and will be automatically used when messages are sent. Unused credits never expire.
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* HISTORY VIEW */}
                {activeView === 'history' && (
                  <motion.div
                    key="history"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    {/* Coming Soon Placeholder */}
                    <div className="text-center py-12">
                      <div className="w-20 h-20 bg-lime-300/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <History className="w-10 h-10 text-lime-300" />
                      </div>
                      <h3 className="text-xl font-semibold text-white mb-2">
                        Transaction History
                      </h3>
                      <p className="text-[#bdbdbd] max-w-md mx-auto">
                        Your credit purchase and reserved history will appear here
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* PURCHASE VIEW */}
                {activeView === 'purchase' && (
                  <motion.div
                    key="purchase"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3"
                  >
                    {/* Package Grid - No scroll */}
                    <div className="grid grid-cols-2 gap-3">
                      {CREDIT_PACKAGES.map((pkg) => {
                        const Icon = pkg.icon;
                        return (
                          <div
                            key={pkg.amount}
                            className={`relative overflow-hidden border rounded-xl p-4 transition-all duration-300 hover:scale-[1.02] cursor-pointer group ${
                              pkg.popular
                                ? 'bg-gradient-to-br from-lime-300/20 to-green-500/10 border-lime-300/50 shadow-[0_0_20px_rgba(196,255,133,0.2)]'
                                : 'bg-white/5 border-white/10 hover:border-lime-300/30'
                            }`}
                          >
                            {/* Best Savings Badge */}
                            {pkg.popular && (
                              <div className="absolute top-3 right-3 px-2 py-0.5 bg-lime-300 text-black text-[10px] font-bold rounded-full shadow-[0_0_8px_#c4ff85]">
                                BIGGEST SAVINGS at 23% off
                              </div>
                            )}

                            {/* Savings Badge */}
                            {pkg.savings && !pkg.popular && (
                              <div className="absolute top-3 right-3 px-2 py-0.5 bg-green-500/20 text-green-400 text-[10px] font-bold rounded-full border border-green-500/30">
                                {pkg.savings}
                              </div>
                            )}

                            {/* Icon */}
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${
                              pkg.popular ? 'bg-lime-300/20' : 'bg-white/10'
                            }`}>
                              <Icon className={`w-6 h-6 ${pkg.popular ? 'text-lime-300' : 'text-white'}`} />
                            </div>

                            {/* Credits for Price - Single Line */}
                            <div className="mb-4">
                              <p className="text-white font-semibold text-lg">
                                {pkg.amount.toLocaleString()} credits for ${pkg.price.toFixed(2)}
                              </p>
                            </div>

                            {/* Buy Button */}
                            <button className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${
                              pkg.popular
                                ? 'bg-lime-300 text-black hover:bg-lime-400 shadow-[0_0_12px_rgba(196,255,133,0.4)] hover:shadow-[0_0_16px_rgba(196,255,133,0.6)]'
                                : 'bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:border-lime-300/50'
                            }`}>
                              <ShoppingCart className="w-4 h-4" />
                              Purchase
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Payment Info - Compact */}
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                      <div className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-lime-300 mt-0.5 flex-shrink-0" />
                        <div className="space-y-1">
                          <h4 className="text-xs font-semibold text-white">Secure Payment</h4>
                          <ul className="space-y-0.5 text-[10px] text-[#bdbdbd]">
                            <li className="flex items-center gap-1.5">
                              <div className="w-1 h-1 bg-lime-300 rounded-full" />
                              Instant credit delivery
                            </li>
                            <li className="flex items-center gap-1.5">
                              <div className="w-1 h-1 bg-lime-300 rounded-full" />
                              Powered by Stripe
                            </li>
                            <li className="flex items-center gap-1.5">
                              <div className="w-1 h-1 bg-lime-300 rounded-full" />
                              Credits never expire
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}