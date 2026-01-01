'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Coins, History, ShoppingCart, Zap, Lock, Gem, Crown, Star, Loader2, Check, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Calendar } from 'lucide-react';
import { supabase } from '@/utils/supabaseClient';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import toast from 'react-hot-toast';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string,
);

type CreditView = 'balance' | 'history' | 'purchase';
type HistorySubView = 'purchases' | 'transactions';

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

interface CreditTransaction {
  id: string;
  action: string;
  old_available: number;
  new_available: number;
  old_reserved: number;
  new_reserved: number;
  created_at: string;
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
  const [historySubView, setHistorySubView] = useState<HistorySubView>('purchases');
  const [availableCredits, setAvailableCredits] = useState<number>(0);
  const [reservedCredits, setReservedCredits] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [pricing, setPricing] = useState<CreditPricing | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchCredits();
      fetchPricing();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && activeView === 'history') {
      fetchTransactions();
    }
  }, [isOpen, activeView]);

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

  const fetchTransactions = async () => {
    setIsLoadingTransactions(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('No user found');
        return;
      }

      const { data, error } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching transactions:', error);
        return;
      }

      setTransactions(data || []);
    } catch (error) {
      console.error('Error in fetchTransactions:', error);
    } finally {
      setIsLoadingTransactions(false);
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
    await fetchTransactions();
    closeCheckout();
    setActiveView('history');
    toast.success('Credits added successfully!')
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);
    const diffInDays = diffInHours / 24;

    if (diffInHours < 1) {
      const minutes = Math.floor(diffInMs / (1000 * 60));
      return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffInHours < 24) {
      const hours = Math.floor(diffInHours);
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    } else if (diffInDays < 7) {
      const days = Math.floor(diffInDays);
      return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const getTransactionType = (transaction: CreditTransaction): 'credit' | 'debit' | 'reserve' | 'release' => {
    const availableDiff = transaction.new_available - transaction.old_available;
    const reservedDiff = transaction.new_reserved - transaction.old_reserved;

    if (availableDiff > 0 && reservedDiff === 0) return 'credit';
    if (availableDiff < 0 && reservedDiff === 0) return 'debit';
    if (reservedDiff > 0) return 'reserve';
    if (reservedDiff < 0) return 'release';
    return 'credit';
  };

  const getTransactionIcon = (type: 'credit' | 'debit' | 'reserve' | 'release') => {
    switch (type) {
      case 'credit':
        return { Icon: ArrowUpRight, color: 'text-lime-300', bg: 'bg-lime-300/20' };
      case 'debit':
        return { Icon: ArrowDownRight, color: 'text-red-400', bg: 'bg-red-400/20' };
      case 'reserve':
        return { Icon: Lock, color: 'text-amber-300', bg: 'bg-amber-300/20' };
      case 'release':
        return { Icon: TrendingUp, color: 'text-sky-300', bg: 'bg-sky-300/20' };
    }
  };

  const filteredTransactions = transactions.filter((transaction) => {
    const isPurchase = transaction.action.startsWith('Credits purchased - ');
    return historySubView === 'purchases' ? isPurchase : !isPurchase;
  });

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
          className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] md:max-h-[73vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/10">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
                <Coins className="w-5 h-5 md:w-6 md:h-6 text-lime-300" />
                <span className="hidden sm:inline">Credits Manager</span>
                <span className="sm:hidden">Credits</span>
              </h2>
              <p className="text-xs md:text-sm text-[#bdbdbd] mt-1 hidden sm:block">
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
          <div className="p-3 md:p-6 border-b border-white/10">
            <div className="flex gap-1 bg-[#0a0a0a] rounded-full p-1">
              <button
                onClick={() => setActiveView('balance')}
                className={`flex-1 px-2 md:px-6 py-2 md:py-3 rounded-full text-xs md:text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-1 md:gap-2 ${
                  activeView === 'balance'
                    ? 'bg-lime-300 text-black shadow-[0_0_12px_#c4ff85]'
                    : 'text-[#bdbdbd] hover:text-white hover:bg-[#2a2a2a]'
                }`}
              >
                <Coins className="w-3 h-3 md:w-4 md:h-4" />
                <span className="hidden sm:inline">Balance</span>
              </button>
              <button
                onClick={() => setActiveView('history')}
                className={`flex-1 px-2 md:px-6 py-2 md:py-3 rounded-full text-xs md:text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-1 md:gap-2 ${
                  activeView === 'history'
                    ? 'bg-lime-300 text-black shadow-[0_0_12px_#c4ff85]'
                    : 'text-[#bdbdbd] hover:text-white hover:bg-[#2a2a2a]'
                }`}
              >
                <History className="w-3 h-3 md:w-4 md:h-4" />
                <span className="hidden sm:inline">History</span>
              </button>
              <button
                onClick={() => setActiveView('purchase')}
                className={`flex-1 px-2 md:px-6 py-2 md:py-3 rounded-full text-xs md:text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-1 md:gap-2 ${
                  activeView === 'purchase'
                    ? 'bg-lime-300 text-black shadow-[0_0_12px_#c4ff85]'
                    : 'text-[#bdbdbd] hover:text-white hover:bg-[#2a2a2a]'
                }`}
              >
                <ShoppingCart className="w-3 h-3 md:w-4 md:h-4" />
                <span className="hidden sm:inline">Buy</span>
                <span className="sm:hidden">Buy</span>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 md:p-6 overflow-y-auto h-[calc(90vh-180px)] md:h-[calc(74vh-180px)]">
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
                    className="space-y-4 md:space-y-6"
                  >
                    {/* Credit Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                      {/* Available Credits */}
                      <div className="relative overflow-hidden bg-gradient-to-br from-lime-300/20 to-green-500/10 border border-lime-300/30 rounded-2xl p-4 md:p-6">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-lime-300/10 rounded-full blur-3xl" />
                        <div className="relative">
                          <div className="flex items-center gap-2 mb-2">
                            <Coins className="w-4 h-4 md:w-5 md:h-5 text-lime-300" />
                            <span className="text-xs md:text-sm font-medium text-lime-300">Available Credits</span>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-3xl md:text-5xl font-bold text-white">{availableCredits.toLocaleString()}</span>
                            <span className="text-sm md:text-lg text-lime-300">credits</span>
                          </div>
                          <p className="text-[10px] md:text-xs text-[#bdbdbd] mt-2 md:mt-3">
                            Ready to use for SMS campaigns and premium features
                          </p>
                        </div>
                      </div>

                      {/* Reserved Credits */}
                      <div className="relative overflow-hidden bg-gradient-to-br from-amber-300/20 to-orange-500/10 border border-amber-300/30 rounded-2xl p-4 md:p-6">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-300/10 rounded-full blur-3xl" />
                        <div className="relative">
                          <div className="flex items-center gap-2 mb-2">
                            <Lock className="w-4 h-4 md:w-5 md:h-5 text-amber-300" />
                            <span className="text-xs md:text-sm font-medium text-amber-300">Reserved Credits</span>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-3xl md:text-5xl font-bold text-white">{reservedCredits.toLocaleString()}</span>
                            <span className="text-sm md:text-lg text-amber-300">credits</span>
                          </div>
                          <p className="text-[10px] md:text-xs text-[#bdbdbd] mt-2 md:mt-3">
                            Allocated for scheduled messages
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Total Balance */}
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 md:p-6">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                          <p className="text-xs md:text-sm text-[#bdbdbd] mb-1">Total Balance</p>
                          <p className="text-2xl md:text-3xl font-bold text-white">
                            {(availableCredits + reservedCredits).toLocaleString()} credits
                          </p>
                        </div>
                        <button
                          onClick={() => setActiveView('purchase')}
                          className="w-full sm:w-auto px-4 md:px-6 py-2 md:py-3 bg-lime-300 text-black rounded-full text-sm md:text-base font-semibold hover:bg-lime-400 transition-all duration-300 shadow-[0_0_12px_rgba(196,255,133,0.4)] hover:shadow-[0_0_16px_rgba(196,255,133,0.6)]"
                        >
                          Buy More Credits
                        </button>
                      </div>
                    </div>

                    {/* Usage Info */}
                    <div className="bg-sky-300/10 border border-sky-300/20 rounded-xl p-3 md:p-4">
                      <div className="flex items-start gap-2 md:gap-3">
                        <Zap className="w-4 h-4 md:w-5 md:h-5 text-sky-300 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="text-xs md:text-sm font-semibold text-sky-300 mb-1">How Credits Work</h4>
                          <p className="text-[10px] md:text-xs text-[#bdbdbd] leading-relaxed">
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
                    className="space-y-3 md:space-y-4"
                  >
                    {/* Sub-view switcher */}
                    <div className="flex gap-1 bg-[#0a0a0a] rounded-full p-1">
                      <button
                        onClick={() => setHistorySubView('purchases')}
                        className={`flex-1 px-3 md:px-4 py-1.5 md:py-2 rounded-full text-[10px] md:text-xs font-semibold transition-all duration-300 ${
                          historySubView === 'purchases'
                            ? 'bg-lime-300 text-black'
                            : 'text-[#bdbdbd] hover:text-white hover:bg-[#2a2a2a]'
                        }`}
                      >
                        Credit Purchases
                      </button>
                      <button
                        onClick={() => setHistorySubView('transactions')}
                        className={`flex-1 px-3 md:px-4 py-1.5 md:py-2 rounded-full text-[10px] md:text-xs font-semibold transition-all duration-300 ${
                          historySubView === 'transactions'
                            ? 'bg-lime-300 text-black'
                            : 'text-[#bdbdbd] hover:text-white hover:bg-[#2a2a2a]'
                        }`}
                      >
                        Credit Transactions
                      </button>
                    </div>

                    {isLoadingTransactions ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 text-lime-300 animate-spin" />
                      </div>
                    ) : filteredTransactions.length === 0 ? (
                      <div className="text-center py-8 md:py-12">
                        <div className="w-16 h-16 md:w-20 md:h-20 bg-lime-300/10 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                          <History className="w-8 h-8 md:w-10 md:h-10 text-lime-300" />
                        </div>
                        <h3 className="text-lg md:text-xl font-semibold text-white mb-2">
                          {historySubView === 'purchases' ? 'No Purchases Yet' : 'No Transactions Yet'}
                        </h3>
                        <p className="text-xs md:text-sm text-[#bdbdbd] max-w-md mx-auto mb-4 md:mb-6 px-4">
                          {historySubView === 'purchases' 
                            ? 'Your credit purchase history will appear here once you make your first purchase'
                            : 'Your credit usage history will appear here once you start using credits'}
                        </p>
                        {historySubView === 'purchases' && (
                          <button
                            onClick={() => setActiveView('purchase')}
                            className="px-4 md:px-6 py-2 md:py-3 bg-lime-300 text-black rounded-full text-sm md:text-base font-semibold hover:bg-lime-400 transition-all duration-300 shadow-[0_0_12px_rgba(196,255,133,0.4)] hover:shadow-[0_0_16px_rgba(196,255,133,0.6)]"
                          >
                            Buy Your First Credits
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredTransactions.map((transaction, index) => {
                          const type = getTransactionType(transaction);
                          const { Icon, color, bg } = getTransactionIcon(type);
                          const availableDiff = transaction.new_available - transaction.old_available;
                          const reservedDiff = transaction.new_reserved - transaction.old_reserved;

                          return (
                            <motion.div
                              key={transaction.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className="bg-white/5 border border-white/10 rounded-xl p-3 md:p-4 hover:bg-white/10 transition-colors"
                            >
                              <div className="flex items-start gap-3 md:gap-4">
                                {/* Icon */}
                                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full ${bg} flex items-center justify-center flex-shrink-0`}>
                                  <Icon className={`w-4 h-4 md:w-5 md:h-5 ${color}`} />
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2 md:gap-4 mb-1 md:mb-2">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs md:text-sm font-semibold text-white mb-0.5 truncate">
                                        {transaction.action}
                                      </p>
                                      <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-[#bdbdbd]">
                                        <Calendar className="w-3 h-3" />
                                        {formatDate(transaction.created_at)}
                                      </div>
                                    </div>

                                    {/* Change Amount */}
                                    <div className="text-right flex-shrink-0">
                                      {availableDiff !== 0 && (
                                        <div className={`text-xs md:text-sm font-semibold ${
                                          availableDiff > 0 ? 'text-lime-300' : 'text-red-400'
                                        }`}>
                                          Available {availableDiff > 0 ? '+' : ''}{availableDiff.toLocaleString()}
                                        </div>
                                      )}
                                      {reservedDiff !== 0 && (
                                        <div className={`text-[10px] md:text-xs font-medium ${
                                          reservedDiff > 0 ? 'text-amber-300' : 'text-sky-300'
                                        }`}>
                                          {/* {reservedDiff > 0 ? 'Reserved' : 'Released'} {Math.abs(reservedDiff).toLocaleString()} */}
                                          Reserved {reservedDiff > 0 ? '+' : ''}{reservedDiff.toLocaleString()}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Balance Details */}
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-[10px] md:text-xs">
                                    <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                                      <span className="text-[#bdbdbd]">Available:</span>
                                      <span className="text-white font-medium">
                                        {transaction.old_available.toLocaleString()} → {transaction.new_available.toLocaleString()}
                                      </span>
                                    </div>
                                    <span className="hidden sm:inline text-[#bdbdbd]">|</span>
                                    <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                                      <span className="text-[#bdbdbd]">Reserved:</span>
                                      <span className="text-white font-medium">
                                        {transaction.old_reserved.toLocaleString()} → {transaction.new_reserved.toLocaleString()}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
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
                    {/* Package Grid */}
                    <div className="grid grid-cols-2 gap-2 md:gap-2.5">
                      {CREDIT_PACKAGES.map((pkg) => {
                        const Icon = pkg.icon;
                        const price = getPrice(pkg.package);
                        
                        return (
                          <div
                            key={pkg.amount}
                            className={`relative overflow-hidden border rounded-xl p-3 transition-all duration-300 hover:scale-[1.02] cursor-pointer group ${
                              pkg.popular
                                ? 'bg-gradient-to-br from-lime-300/20 to-green-500/10 border-lime-300/50 shadow-[0_0_20px_rgba(196,255,133,0.2)]'
                                : 'bg-white/5 border-white/10 hover:border-lime-300/30'
                            }`}
                          >
                            {/* Best Savings Badge */}
                            {pkg.popular && (
                              <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-lime-300 text-black text-[8px] md:text-[9px] font-bold rounded-full shadow-[0_0_8px_#c4ff85]">
                                <span className="hidden sm:inline">BIGGEST SAVINGS at </span>23% off
                              </div>
                            )}

                            {/* Savings Badge */}
                            {pkg.savings && !pkg.popular && (
                              <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[8px] md:text-[9px] font-bold rounded-full border border-green-500/30">
                                {pkg.savings}
                              </div>
                            )}

                            {/* Icon */}
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                              pkg.popular ? 'bg-lime-300/20' : 'bg-white/10'
                            }`}>
                              <Icon className={`w-5 h-5 ${pkg.popular ? 'text-lime-300' : 'text-white'}`} />
                            </div>

                            {/* Credits for Price */}
                            <div className="mb-2.5">
                              <p className="text-white font-semibold text-sm">
                                {pkg.amount.toLocaleString()} credits
                              </p>
                              <p className="text-lime-300 text-xs">
                                ${price.toFixed(2)}
                              </p>
                            </div>

                            {/* Buy Button */}
                            <button 
                              onClick={() => handlePurchase(pkg.package)}
                              disabled={isPurchasing || !pricing}
                              className={`w-full py-2 rounded-lg font-semibold text-xs transition-all duration-300 flex items-center justify-center gap-1 md:gap-2 ${
                                pkg.popular
                                  ? 'bg-lime-300 text-black hover:bg-lime-400 shadow-[0_0_12px_rgba(196,255,133,0.4)] hover:shadow-[0_0_16px_rgba(196,255,133,0.6)] disabled:opacity-50'
                                  : 'bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:border-lime-300/50 disabled:opacity-50'
                              }`}
                            >
                              {isPurchasing && selectedPackage === pkg.package ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <>
                                  <ShoppingCart className="w-3 h-3" />
                                  <span className="hidden sm:inline">Purchase</span>
                                  <span className="sm:hidden">Buy</span>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Payment Info */}
                    <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
                      <div className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-lime-300 mt-0.5 flex-shrink-0" />
                        <div className="space-y-0.5">
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
              className="relative w-full max-w-lg bg-[#1a1a1a] border border-white/10 rounded-2xl p-4 md:p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
            >
              <button
                onClick={closeCheckout}
                className="absolute top-3 right-3 md:top-4 md:right-4 inline-flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition p-2 z-10"
                aria-label="Close checkout"
              >
                <X className="w-4 h-4 text-gray-200" />
              </button>

              <div className="mb-6">
                <h2 className="text-lg md:text-xl font-bold text-white mb-1">
                  Complete Your Purchase
                </h2>
                <p className="text-xs md:text-sm text-[#bdbdbd] mt-2 -mb-4">
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