/**
 * CreditUsageModal Component
 *
 * Detailed usage dashboard with current balance, feature breakdown,
 * and transaction history.
 */

import { createPortal } from 'react-dom';
import { X, Target, Sparkles, TrendingUp, MessageSquare, Mail, FileText, Download, Coins, Clock } from 'lucide-react';
import { useEffect, useState, type ComponentType } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useUserCredits } from '../../hooks/useUserCredits';
import { supabase } from '../../services/supabase';
import { glass } from '../../lib/styles/glass';
import { cn } from '../../lib/utils/cn';
import { useTranslation } from 'react-i18next';
import type { CreditTransaction } from '../../types/credits';

interface CreditUsageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FEATURE_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  parse_resume: FileText,
  ai_match: Target,
  vision2030: TrendingUp,
  optimize: Sparkles,
  interview_prep: MessageSquare,
  cover_letter: Mail,
  export_template: Download,
};

export function CreditUsageModal({ isOpen, onClose }: CreditUsageModalProps) {
  const { user } = useAuth();
  const { credits } = useUserCredits();
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !user) return;

    async function fetchTransactions() {
      try {
        const { data, error } = await supabase
          .from('credit_transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) {
          console.error('[CreditUsageModal] Fetch error:', error);
          throw error;
        }

        setTransactions(
          (data || []).map((tx) => ({
            id: tx.id,
            userId: tx.user_id,
            feature: tx.feature,
            amount: tx.amount,
            creditsBefore: tx.credits_before,
            creditsAfter: tx.credits_after,
            transactionType: tx.transaction_type,
            metadata: tx.metadata || {},
            createdAt: tx.created_at,
          }))
        );
      } catch (err) {
        console.error('[CreditUsageModal] Failed to fetch transactions:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTransactions();
  }, [isOpen, user]);

  if (!isOpen) return null;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'consumption':
        return 'text-red-400';
      case 'feedback_reward':
      case 'referral_reward':
        return 'text-emerald-400';
      case 'monthly_reset':
        return 'text-blue-400';
      default:
        return 'text-gray-400';
    }
  };

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={cn(
          glass.elevated,
          'relative rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto'
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="credit-usage-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-emerald-400" />
            <h3
              id="credit-usage-title"
              className="text-lg font-semibold text-white"
            >
              {t('credits.usage.title')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Balance */}
        {credits && (
          <div className={cn(glass.card, 'p-6 mb-6 border-emerald-500/30')}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-400 mb-1">
                  {t('credits.balance')}
                </p>
                <p className="text-3xl font-bold text-white">
                  {credits.remaining}{' '}
                  <span className="text-lg text-gray-400">
                    / {credits.total}
                  </span>
                </p>
              </div>
              <Coins className="w-12 h-12 text-emerald-400 opacity-50" />
            </div>

            {/* Earned credits */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
              <div>
                <p className="text-xs text-gray-400 mb-1">
                  {t('credits.usage.feedbackEarned')}
                </p>
                <p className="text-sm font-medium text-emerald-400">
                  +{credits.feedbackCreditsEarned}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">
                  {t('credits.usage.referralEarned')}
                </p>
                <p className="text-sm font-medium text-emerald-400">
                  +{credits.referralCreditsEarned}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Transaction History */}
        <div>
          <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {t('credits.usage.history')}
          </h4>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={cn(glass.card, 'p-4 animate-pulse')}
                >
                  <div className="h-4 bg-white/10 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-white/10 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className={cn(glass.card, 'p-6 text-center')}>
              <p className="text-gray-400">
                {t('credits.usage.noTransactions')}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => {
                const Icon = FEATURE_ICONS[tx.feature] || Coins;
                const isPositive = tx.amount > 0;

                return (
                  <div
                    key={tx.id}
                    className={cn(glass.card, 'p-4 flex items-center justify-between')}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(glass.badge.neutral, 'p-2')}>
                        <Icon className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">
                          {tx.feature.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatDate(tx.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p
                        className={cn(
                          'text-sm font-medium',
                          getTransactionColor(tx.transactionType)
                        )}
                      >
                        {isPositive ? '+' : ''}
                        {tx.amount}
                      </p>
                      <p className="text-xs text-gray-400">
                        {tx.creditsAfter} total
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
