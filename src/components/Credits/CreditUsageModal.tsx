/**
 * CreditUsageModal Component
 *
 * Detailed usage dashboard with current balance, feature breakdown,
 * and transaction history.
 */

import { createPortal } from 'react-dom';
import { X, Target, Sparkles, TrendingUp, MessageSquare, Mail, FileText, Download, Coins, Clock, Gift, RefreshCw } from 'lucide-react';
import { useEffect, useState, type ComponentType } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useUserCredits } from '../../hooks/useUserCredits';
import { supabase } from '../../services/supabase';
import { glass } from '../../lib/styles/glass';
import { cn } from '../../lib/utils/cn';
import { useTranslation } from 'react-i18next';
import type { CreditTransaction } from '../../types/credits';
import { ReferralLink } from '../Referrals/ReferralLink';
import { ReferralStats } from '../Referrals/ReferralStats';

interface CreditUsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  viewMode?: 'full' | 'invite-only';
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

export function CreditUsageModal({ isOpen, onClose, viewMode = 'full' }: CreditUsageModalProps) {
  const { user } = useAuth();
  const { credits, refetch } = useUserCredits();
  const { t, i18n } = useTranslation();
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isArabic = i18n.language === 'ar';

  // Only fetch transactions if in full mode
  useEffect(() => {
    if (!isOpen || !user || viewMode !== 'full') return;

    async function fetchTransactions() {
      try {
        const { data, error } = await supabase
          .from('credit_transactions')
          .select('*')
          .eq('email', user.email)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) {
          console.error('[CreditUsageModal] Fetch error:', error);
          throw error;
        }

        setTransactions(
          (data || []).map((tx) => ({
            id: tx.id,
            email: tx.email,
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
  }, [isOpen, user, viewMode]);

  if (!isOpen) return null;

  const humanizeFeature = (feature: string) =>
    feature.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

  const getFeatureLabel = (feature: string) =>
    t(`credits.usage.features.${feature}`, humanizeFeature(feature));

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return t('credits.usage.time.justNow', 'Just now');
    if (diffMins < 60) return t('credits.usage.time.minutesAgo', { count: diffMins });

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return t('credits.usage.time.hoursAgo', { count: diffHours });

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return t('credits.usage.time.daysAgo', { count: diffDays });

    return date.toLocaleDateString(isArabic ? 'ar-SA' : 'en-US');
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'consumption':
        return 'text-red-400';
      case 'feedback_reward':
      case 'referral_reward':
      case 'celebration_bonus':
        return 'text-emerald-400';
      case 'monthly_reset':
        return 'text-blue-400';
      default:
        return 'text-gray-400';
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } catch (error) {
      console.error('[CreditUsageModal] Failed to refresh credits:', error);
    } finally {
      // Small delay for visual feedback
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const modal = (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
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
          'relative rounded-xl p-4 sm:p-6 w-full max-h-[85vh] sm:max-h-[80vh] overflow-y-auto',
          viewMode === 'full' ? 'max-w-2xl' : 'max-w-md'
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="credit-usage-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            {viewMode === 'full' ? (
              <Coins className="w-5 h-5 text-emerald-400" />
            ) : (
              <Gift className="w-5 h-5 text-emerald-400" />
            )}
            <h3
              id="credit-usage-title"
              className="text-lg font-semibold text-gray-900 dark:text-white"
            >
              {viewMode === 'full' ? t('credits.usage.title') : t('referrals.inviteEarn')}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={cn(
                "text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 transition-colors",
                isRefreshing && "animate-spin text-emerald-500 dark:text-emerald-400"
              )}
              aria-label={t('credits.refresh', 'Refresh credits')}
              title={t('credits.refresh', 'Refresh credits')}
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            {/* Close Button */}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors"
              aria-label={t('common.closeDialog', 'Close dialog')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {viewMode === 'full' ? (
          <>
            {/* Current Balance */}
            {credits && (
              <div className={cn(glass.card, 'p-6 mb-6 border-emerald-500/30')}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      {t('credits.balance')}
                    </p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      <span dir={isArabic ? 'rtl' : 'ltr'} className="inline-block" style={{ unicodeBidi: 'isolate' }}>
                        {t('credits.balanceDisplay', {
                          remaining: credits.remaining,
                          total: credits.total,
                        })}
                      </span>
                    </p>
                  </div>
                  <Coins className="w-12 h-12 text-emerald-500 dark:text-emerald-400 opacity-50" />
                </div>

                {/* Earned credits */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-white/10">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      {t('credits.usage.feedbackEarned')}
                    </p>
                    <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      +{credits.feedbackCreditsEarned}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      {t('credits.usage.referralEarned')}
                    </p>
                    <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      +{credits.referralCreditsEarned}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Referral Section */}
            <div className="mb-6 space-y-4">
              <ReferralStats />
              <ReferralLink />
            </div>

            {/* Transaction History */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
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
                  <p className="text-gray-600 dark:text-gray-400">
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
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {getFeatureLabel(tx.feature)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
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
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {t('credits.transactionTotal', { total: tx.creditsAfter })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <p className="text-gray-700 dark:text-white/80">
                {t('referrals.shareLink')}
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                <span className="text-emerald-400 font-bold">{t('referrals.youGet')}</span>
                <span className="text-gray-400 dark:text-white/40">•</span>
                <span className="text-emerald-400 font-bold">{t('referrals.theyGet')}</span>
              </div>
            </div>
            <ReferralLink />
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

