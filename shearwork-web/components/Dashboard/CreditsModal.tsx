'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Coins, History, ShoppingCart, Zap, Lock, Gem, Crown, Star, Loader2, Check } from 'lucide-react';
import { supabase } from '@/utils/supabaseClient';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string,
);

type CreditView = 'balance' | 'history' | 'purchase';

interface CreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CreditPrice {
  id: string;
  amount: number;
  currency: string;
}

interface CreditPricing {
  credits100: CreditPrice;
  credits250: CreditPrice;
  credits500: CreditPrice;
  credits1000: CreditPrice;
}

const CREDIT_PACKAGES = [
  {
    amount: 100,
    package: '100',
    popular: false,
    icon: Coins,
  },
  {
    amount: 250,
    package: '250',
    popular: false,
    savings: '11% off',
    icon: Star,
  },
  {
    amount: 500,
    package: '500',
    popular: false,
    savings: '15% off',
    icon: Gem,
  },
  {
    amount: 1000,
    package: '1000',
    popular: true,
    savings: '23% off',
    icon: Crown,
  },
];

// Payment Form Component
function CheckoutForm({ 
  onSuccess, 
  onCancel, 
  packageAmount,
  packagePrice
}: { 
  onSuccess: () => void; 
  onCancel: () => void; 
  packageAmount: number;
  packagePrice: number;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const handleSubmit = async () => {
    if (!stripe || !elements || !isReady) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/credits/success`,
      },
      redirect: 'if_required',
    });

    if (error) {
      setErrorMessage(error.message || 'An error occurred');
      setIsProcessing(false);
    } else {
      onSuccess();
    }
  };

  return (
    <div className="space-y-6">
      <PaymentElement 
        onReady={() => setIsReady(true)}
      />

      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
          {errorMessage}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1 px-6 py-3 bg-white/10 text-white rounded-lg font-semibold hover:bg-white/20 transition-all duration-300 border border-white/20 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!stripe || !isReady || isProcessing}
          className="flex-1 px-6 py-3 bg-lime-300 text-black rounded-lg font-semibold hover:bg-lime-400 transition-all duration-300 shadow-[0_0_12px_rgba(196,255,133,0.4)] hover:shadow-[0_0_16px_rgba(196,255,133,0.6)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {!isReady && !isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </>
          ) : isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Pay ${packagePrice.toFixed(2)}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default function CreditsModal({
  isOpen,
  onClose,
}: CreditsModalProps) {
  const [activeView, setActiveView] = useState<CreditView>('balance');
  const [availableCredits, setAvailableCredits] = useState<number>(0);
  const [reservedCredits, setReservedCredits] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [pricing, setPricing] = useState<CreditPricing | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchCredits();
      fetchPricing();
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

  const fetchPricing = async () => {
    try {
      const response = await fetch('/api/stripe-credits/pricing');
      if (!response.ok) {
        throw new Error('Failed to fetch pricing');
      }
      const data = await response.json();
      setPricing(data);
    } catch (error) {
      console.error('Error fetching pricing:', error);
    }
  };

  const handlePurchase = async (packageType: string) => {
    setIsPurchasing(true);
    setSelectedPackage(packageType);
    try {
      const response = await fetch('/api/stripe-credits/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ package: packageType }),
      });

      if (!response.ok) {
        throw new Error('Failed to create payment intent');
      }

      const { clientSecret } = await response.json();

      if (!clientSecret) {
        throw new Error('No clientSecret in response');
      }

      setClientSecret(clientSecret);
      
    } catch (error) {
      console.error('Error purchasing credits:', error);
      setSelectedPackage(null);
    } finally {
      setIsPurchasing(false);
    }
  };

  const closeCheckout = () => {
    setClientSecret(null);
    setSelectedPackage(null);
  };

  const handlePaymentSuccess = async () => {
    await fetchCredits();
    closeCheckout();
    setActiveView('balance');
  };

  const getPrice = (packageType: string): number => {
    if (!pricing) return 0;
    const key = `credits${packageType}` as keyof CreditPricing;
    return (pricing[key]?.amount || 0) / 100;
  };

  const getPackageAmount = (packageType: string): number => {
    const pkg = CREDIT_PACKAGES.find(p => p.package === packageType);
    return pkg?.amount || 0;
  };

  if (!isOpen) return null;

  const stripeOptions = {
    clientSecret: clientSecret || '',
    appearance: {
      theme: 'night' as const,
      variables: {
        colorPrimary: '#c4ff85',
        colorBackground: '#1a1a1a',
        colorText: '#ffffff',
        colorDanger: '#ef4444',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        spacingUnit: '4px',
        borderRadius: '8px',
        colorTextSecondary: '#bdbdbd',
        colorTextPlaceholder: '#6b7280',
      },
      rules: {
        '.Input': {
          backgroundColor: '#0a0a0a',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: 'none',
        },
        '.Input:focus': {
          border: '1px solid #c4ff85',
          boxShadow: '0 0 0 1px #c4ff85',
        },
        '.Label': {
          color: '#bdbdbd',
          fontSize: '14px',
        },
      },
    },
  };

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
                        const price = getPrice(pkg.package);
                        
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
                                {pkg.amount.toLocaleString()} credits for ${price.toFixed(2)}
                              </p>
                            </div>

                            {/* Buy Button */}
                            <button 
                              onClick={() => handlePurchase(pkg.package)}
                              disabled={isPurchasing || !pricing}
                              className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${
                                pkg.popular
                                  ? 'bg-lime-300 text-black hover:bg-lime-400 shadow-[0_0_12px_rgba(196,255,133,0.4)] hover:shadow-[0_0_16px_rgba(196,255,133,0.6)] disabled:opacity-50'
                                  : 'bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:border-lime-300/50 disabled:opacity-50'
                              }`}
                            >
                              {isPurchasing && selectedPackage === pkg.package ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <ShoppingCart className="w-4 h-4" />
                                  Purchase
                                </>
                              )}
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

        {/* Payment Modal */}
        {clientSecret && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-4"
            onClick={closeCheckout}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
            >
              <button
                onClick={closeCheckout}
                className="absolute top-4 right-4 inline-flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition p-2 z-10"
                aria-label="Close checkout"
              >
                <X className="w-4 h-4 text-gray-200" />
              </button>

              <div className="mb-6">
                <h2 className="text-xl font-bold text-white mb-1">
                  Complete Your Purchase
                </h2>
                <p className="text-sm text-[#bdbdbd] mt-2 -mb-4">
                  {selectedPackage && `${getPackageAmount(selectedPackage).toLocaleString()} credits • $${getPrice(selectedPackage).toFixed(2)}`}
                </p>
              </div>

              <Elements stripe={stripePromise} options={stripeOptions}>
                <CheckoutForm 
                  onSuccess={handlePaymentSuccess}
                  onCancel={closeCheckout}
                  packageAmount={selectedPackage ? getPackageAmount(selectedPackage) : 0}
                  packagePrice={selectedPackage ? getPrice(selectedPackage) : 0}
                />
              </Elements>
            </motion.div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}