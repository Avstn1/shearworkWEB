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
        <div className="rounded-lg border border-[#D99A8B]/25 bg-[#D99A8B]/[0.06] px-3 py-2.5 text-sm text-[#D99A8B]">
          {errorMessage}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-white/[0.07] pt-4 sm:flex-row sm:justify-end">
        <button
          onClick={onCancel}
          disabled={isProcessing}
          className="btn btn-ghost btn-sm"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!stripe || !isReady || isProcessing}
          className="btn btn-primary btn-sm tabular-nums"
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
    if (typeof document === 'undefined') return;
    const className = 'tutorial-hide-credits';
    if (isOpen) {
      document.body.classList.add(className);
    } else {
      document.body.classList.remove(className);
    }

    return () => {
      document.body.classList.remove(className);
    };
  }, [isOpen]);

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
        return { Icon: ArrowUpRight, color: 'text-sage-bright', bg: 'bg-sage/[0.12]' };
      case 'debit':
        return { Icon: ArrowDownRight, color: 'text-[#D99A8B]', bg: 'bg-[#D99A8B]/[0.12]' };
      case 'reserve':
        return { Icon: Lock, color: 'text-[#D8C59A]', bg: 'bg-[#D8C59A]/[0.12]' };
      case 'release':
        return { Icon: TrendingUp, color: 'text-[#A9C0D2]', bg: 'bg-[#A9C0D2]/[0.12]' };
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
        colorPrimary: '#8FB57A',
        colorBackground: '#171A18',
        colorText: '#ECEDEA',
        colorDanger: '#D99A8B',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        spacingUnit: '4px',
        borderRadius: '8px',
        colorTextSecondary: '#9EA39C',
        colorTextPlaceholder: '#7C817A',
      },
      rules: {
        '.Input': {
          backgroundColor: '#111312',
          border: '1px solid rgba(255, 255, 255, 0.09)',
          boxShadow: 'none',
        },
        '.Input:focus': {
          border: '1px solid rgba(143, 181, 122, 0.6)',
          boxShadow: '0 0 0 3px rgba(143, 181, 122, 0.15)',
        },
        '.Label': {
          color: '#9EA39C',
          fontSize: '13px',
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
        className="modal-backdrop z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 12, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          className="modal-surface max-w-3xl w-full max-h-[90vh] md:max-h-[73vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-white/[0.07]">
            <div className="min-w-0">
              <h2 className="panel-title flex items-center gap-2">
                <Coins className="w-4 h-4 text-sage" strokeWidth={1.75} />
                <span className="hidden sm:inline">Credits Manager</span>
                <span className="sm:hidden">Credits</span>
              </h2>
              <p className="panel-subtitle hidden sm:block">
                Manage your credits for SMS campaigns and premium features
              </p>
            </div>
            <button
              onClick={onClose}
              className="btn btn-ghost btn-sm !h-8 !w-8 !p-0"
              aria-label="Close"
            >
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>

          {/* View Switcher */}
          <div className="px-5 py-3 border-b border-white/[0.07]">
            <div className="segmented w-full">
              <button
                onClick={() => setActiveView('balance')}
                data-active={activeView === 'balance'}
                className="segmented-item flex items-center justify-center gap-1.5"
              >
                <Coins className="w-4 h-4" strokeWidth={1.75} />
                <span className="hidden sm:inline">Balance</span>
              </button>
              <button
                onClick={() => setActiveView('history')}
                data-active={activeView === 'history'}
                className="segmented-item flex items-center justify-center gap-1.5"
              >
                <History className="w-4 h-4" strokeWidth={1.75} />
                <span className="hidden sm:inline">History</span>
              </button>
              <button
                onClick={() => setActiveView('purchase')}
                data-active={activeView === 'purchase'}
                className="segmented-item flex items-center justify-center gap-1.5"
              >
                <ShoppingCart className="w-4 h-4" strokeWidth={1.75} />
                <span className="hidden sm:inline">Buy</span>
                <span className="sm:hidden">Buy</span>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 md:p-6 overflow-y-auto h-[calc(90vh-180px)] md:h-[calc(74vh-180px)]">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-sage animate-spin" />
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Available Credits */}
                      <div className="rounded-lg border border-white/[0.07] bg-raised p-4 md:p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <Coins className="w-4 h-4 text-sage" strokeWidth={1.75} />
                          <span className="stat-label">Available credits</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="stat-value">{availableCredits.toLocaleString()}</span>
                          <span className="text-sm text-muted">credits</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Ready to use for SMS campaigns and premium features
                        </p>
                      </div>

                      {/* Reserved Credits */}
                      <div className="rounded-lg border border-white/[0.07] bg-raised p-4 md:p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <Lock className="w-4 h-4 text-[#D8C59A]" strokeWidth={1.75} />
                          <span className="stat-label">Reserved credits</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="stat-value">{reservedCredits.toLocaleString()}</span>
                          <span className="text-sm text-muted">credits</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Allocated for scheduled messages
                        </p>
                      </div>
                    </div>

                    {/* Total Balance */}
                    <div className="rounded-lg border border-white/[0.07] p-4 md:p-5">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                          <p className="stat-label mb-1">Total balance</p>
                          <p className="text-xl md:text-2xl font-semibold tabular-nums text-ivory">
                            {(availableCredits + reservedCredits).toLocaleString()} credits
                          </p>
                        </div>
                        <button
                          onClick={() => setActiveView('purchase')}
                          className="btn btn-primary btn-sm w-full sm:w-auto"
                        >
                          Buy More Credits
                        </button>
                      </div>
                    </div>

                    {/* Usage Info */}
                    <div className="flex items-start gap-2.5 rounded-lg border border-white/[0.07] bg-raised px-3 py-3 md:px-4">
                      <Zap className="w-4 h-4 text-[#A9C0D2] mt-0.5 flex-shrink-0" strokeWidth={1.75} />
                      <div>
                        <h4 className="text-[13px] font-semibold text-ivory mb-1">How credits work</h4>
                        <p className="text-xs text-gray-400 leading-relaxed">
                          Credits are used for SMS campaigns, premium analytics, and advanced features. 
                          Each SMS message costs 1 credit. Reserved credits are allocated for your scheduled messages and will be automatically used when messages are sent. Unused credits never expire.
                        </p>
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
                    <div className="segmented w-full">
                      <button
                        onClick={() => setHistorySubView('purchases')}
                        data-active={historySubView === 'purchases'}
                        className="segmented-item"
                      >
                        Credit Purchases
                      </button>
                      <button
                        onClick={() => setHistorySubView('transactions')}
                        data-active={historySubView === 'transactions'}
                        className="segmented-item"
                      >
                        Credit Transactions
                      </button>
                    </div>

                    {isLoadingTransactions ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 text-sage animate-spin" />
                      </div>
                    ) : filteredTransactions.length === 0 ? (
                      <div className="empty-state">
                        <History strokeWidth={1.75} />
                        <strong>
                          {historySubView === 'purchases' ? 'No Purchases Yet' : 'No Transactions Yet'}
                        </strong>
                        <p className="max-w-md mx-auto mb-2 px-4">
                          {historySubView === 'purchases' 
                            ? 'Your credit purchase history will appear here once you make your first purchase'
                            : 'Your credit usage history will appear here once you start using credits'}
                        </p>
                        {historySubView === 'purchases' && (
                          <button
                            onClick={() => setActiveView('purchase')}
                            className="btn btn-primary btn-sm"
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
                              className="rounded-lg border border-white/[0.07] p-3 md:p-4 hover:bg-white/[0.02] transition-colors"
                            >
                              <div className="flex items-start gap-3 md:gap-4">
                                {/* Icon */}
                                <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                                  <Icon className={`w-4 h-4 ${color}`} strokeWidth={1.75} />
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2 md:gap-4 mb-1 md:mb-2">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[13px] md:text-sm font-semibold text-ivory mb-0.5 truncate">
                                        {transaction.action}
                                      </p>
                                      <div className="flex items-center gap-1.5 text-[11px] md:text-xs text-gray-500">
                                        <Calendar className="w-3 h-3" strokeWidth={1.75} />
                                        {formatDate(transaction.created_at)}
                                      </div>
                                    </div>

                                    {/* Change Amount */}
                                    <div className="text-right flex-shrink-0">
                                      {availableDiff !== 0 && (
                                        <div className={`text-xs md:text-sm font-semibold tabular-nums ${
                                          availableDiff > 0 ? 'text-sage-bright' : 'text-[#D99A8B]'
                                        }`}>
                                          Available {availableDiff > 0 ? '+' : ''}{availableDiff.toLocaleString()}
                                        </div>
                                      )}
                                      {reservedDiff !== 0 && (
                                        <div className={`text-[11px] md:text-xs font-medium tabular-nums ${
                                          reservedDiff > 0 ? 'text-[#D8C59A]' : 'text-[#A9C0D2]'
                                        }`}>
                                          {/* {reservedDiff > 0 ? 'Reserved' : 'Released'} {Math.abs(reservedDiff).toLocaleString()} */}
                                          Reserved {reservedDiff > 0 ? '+' : ''}{reservedDiff.toLocaleString()}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Balance Details */}
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-[11px] md:text-xs tabular-nums">
                                    <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                                      <span className="text-gray-500">Available:</span>
                                      <span className="text-gray-300 font-medium">
                                        {transaction.old_available.toLocaleString()} → {transaction.new_available.toLocaleString()}
                                      </span>
                                    </div>
                                    <span className="hidden sm:inline text-gray-500">|</span>
                                    <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                                      <span className="text-gray-500">Reserved:</span>
                                      <span className="text-gray-300 font-medium">
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
                            className={`relative rounded-lg border p-3 md:p-4 transition-colors ${
                              pkg.popular
                                ? 'border-sage/45 bg-raised'
                                : 'border-white/[0.07] bg-raised hover:border-white/[0.12]'
                            }`}
                          >
                            {/* Best Savings Badge */}
                            {pkg.popular && (
                              <span className="badge badge-sage absolute top-2 right-2">
                                <span className="hidden sm:inline">Biggest savings at </span>23% off
                              </span>
                            )}

                            {/* Savings Badge */}
                            {pkg.savings && !pkg.popular && (
                              <span className="badge absolute top-2 right-2">
                                {pkg.savings}
                              </span>
                            )}

                            {/* Icon */}
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2.5 ${
                              pkg.popular ? 'bg-sage/[0.12]' : 'bg-white/[0.06]'
                            }`}>
                              <Icon className={`w-4 h-4 ${pkg.popular ? 'text-sage-bright' : 'text-gray-300'}`} strokeWidth={1.75} />
                            </div>

                            {/* Credits for Price */}
                            <div className="mb-2.5">
                              <p className="text-ivory font-semibold text-sm tabular-nums">
                                {pkg.amount.toLocaleString()} credits
                              </p>
                              <p className="text-muted text-[13px] font-medium tabular-nums">
                                ${price.toFixed(2)}
                              </p>
                            </div>

                            {/* Buy Button */}
                            <button 
                              onClick={() => handlePurchase(pkg.package)}
                              disabled={isPurchasing || !pricing}
                              className={`btn btn-sm w-full ${pkg.popular ? 'btn-primary' : 'btn-glass'}`}
                            >
                              {isPurchasing && selectedPackage === pkg.package ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <>
                                  <ShoppingCart className="w-3.5 h-3.5" strokeWidth={1.75} />
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
                    <div className="rounded-lg border border-white/[0.07] px-3 py-2.5">
                      <div className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-sage mt-0.5 flex-shrink-0" strokeWidth={2} />
                        <div className="space-y-1">
                          <h4 className="text-xs font-semibold text-ivory">Secure payment</h4>
                          <ul className="space-y-0.5 text-[11px] text-gray-400">
                            <li className="flex items-center gap-1.5">
                              <div className="w-1 h-1 bg-sage rounded-full" />
                              Instant credit delivery
                            </li>
                            <li className="flex items-center gap-1.5">
                              <div className="w-1 h-1 bg-sage rounded-full" />
                              Powered by Stripe
                            </li>
                            <li className="flex items-center gap-1.5">
                              <div className="w-1 h-1 bg-sage rounded-full" />
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
            className="modal-backdrop flex items-center justify-center px-4"
            onClick={closeCheckout}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              className="modal-surface relative w-full max-w-lg max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-white/[0.07]">
                <div className="min-w-0">
                  <h2 className="panel-title">Complete your purchase</h2>
                  <p className="panel-subtitle tabular-nums">
                    {selectedPackage && `${getPackageAmount(selectedPackage).toLocaleString()} credits · $${getPrice(selectedPackage).toFixed(2)}`}
                  </p>
                </div>
                <button
                  onClick={closeCheckout}
                  className="btn btn-ghost btn-sm !h-8 !w-8 !p-0"
                  aria-label="Close checkout"
                >
                  <X className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>

              <div className="p-5">

              <Elements stripe={stripePromise} options={stripeOptions}>
                <CheckoutForm 
                  onSuccess={handlePaymentSuccess}
                  onCancel={closeCheckout}
                  packageAmount={selectedPackage ? getPackageAmount(selectedPackage) : 0}
                  packagePrice={selectedPackage ? getPrice(selectedPackage) : 0}
                />
              </Elements>
              </div>
            </motion.div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
