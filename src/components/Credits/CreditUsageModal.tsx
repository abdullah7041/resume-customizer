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
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { usePaymentConfig } from '@/hooks/usePaymentConfig';
import { readPurchaseHistory } from '@/services/payments';
import { useExitPresence } from '@/hooks/useExitPresence';

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

const humanizeFeature = (feature: string) =>
  feature.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const getTransactionColor = (type: string) => {
  switch (type) {
    case 'consumption':
      return 'text-red-400';
    case 'purchase':
    case 'feedback_reward':
    case 'referral_reward':
    case 'celebration_bonus':
      return 'text-emerald-400';
    case 'monthly_reset':
      return 'text-teal-500 dark:text-teal-300';
    default:
      return 'text-gray-400';
  }
};

export function CreditUsageModal({ isOpen, onClose, viewMode = 'full' }: CreditUsageModalProps) {
  const { user } = useAuth();
  const { credits, refetch } = useUserCredits();
  const { t, i18n } = useTranslation();
  type Activity = Pick<CreditTransaction, 'id' | 'feature' | 'amount' | 'createdAt'> & { creditsAfter?: number; transactionType: string };
  const [transactions, setTransactions] = useState<Activity[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [historyError, setHistoryError] = useState(false);
  const paymentConfig = usePaymentConfig(isOpen && viewMode === 'full');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isArabic = i18n.language === 'ar';
  const referralEnabled = useFeatureFlag('referral');
  const { shouldRender, isExiting } = useExitPresence(isOpen);

  // Only fetch transactions if in full mode
  useEffect(() => {
    if (!isOpen || !user || viewMode !== 'full') return;

    const controller = new AbortController();
    setIsLoading(true);
    setHistoryError(false);
    async function fetchTransactions() {
      const [ledger, purchases] = await Promise.allSettled([
        supabase.from('credit_transactions').select('id,feature,amount,credits_after,transaction_type,created_at')
          .eq('email', user.email).order('created_at', { ascending: false }).limit(20).abortSignal(controller.signal),
        readPurchaseHistory(controller.signal),
      ]);
      if (controller.signal.aborted) return;
      const rows: Activity[] = ledger.status === 'fulfilled' && !ledger.value.error
        ? (ledger.value.data ?? []).map(tx => ({ id: tx.id, feature: tx.feature, amount: tx.amount,
          creditsAfter: tx.credits_after, transactionType: tx.transaction_type, createdAt: tx.created_at }))
        : [];
      if (purchases.status === 'fulfilled') {
        rows.push(...purchases.value.map(tx => ({ ...tx, feature: 'purchase', transactionType: 'purchase' })));
      }
      setTransactions(rows.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 20));
      setHistoryError(ledger.status === 'rejected' || Boolean(ledger.value.error) || purchases.status === 'rejected');
      setIsLoading(false);
    }
    void fetchTransactions();
    return () => controller.abort();
  }, [isOpen, user, viewMode, refresh]);

  if (!shouldRender) return null;

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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefresh(value => value + 1);
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
    <div
      className={cn(
        'fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6',
        isExiting && 'pointer-events-none'
      )}
      aria-hidden={isExiting || undefined}
      inert={isExiting}
    >
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/60 backdrop-blur-md duration-200',
          isExiting ? 'animate-out fade-out ease-out' : 'animate-in fade-in'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={cn(
          glass.elevated,
          'relative rounded-xl p-4 sm:p-6 w-full max-h-[85vh] sm:max-h-[80vh] overflow-y-auto duration-200 ease-out',
          isExiting ? 'animate-out fade-out zoom-out-95' : 'animate-in fade-in zoom-in-95',
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
              type="button"
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
              type="button"
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
                  {paymentConfig?.enabled && <a href="/checkout" className="inline-flex min-h-11 items-center rounded-lg bg-emerald-700 px-3 text-sm font-semibold text-white">{t('pricing.pack.cta')}</a>}
                </div>

                {/* Earned credits */}
                <div className="grid grid-cols-2 gap-4 pt-4 sm:grid-cols-3 border-t border-gray-200 dark:border-white/10">
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
                  {credits.purchasedRemaining != null && <div>
                    <p className="text-xs text-ink-muted mb-1">{t('credits.usage.purchasedRemaining')}</p>
                    <p className="text-sm font-medium text-ink">{credits.purchasedRemaining}</p>
                  </div>}
                </div>
              </div>
            )}

            {/* Referral Section */}
            {referralEnabled && (
              <div className="mb-6 space-y-4">
                <ReferralStats />
                <ReferralLink />
              </div>
            )}

            {/* Transaction History */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {t('credits.usage.history')}
              </h4>

              {historyError && <p role="status">{t('credits.usage.historyError')}</p>}
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
              ) : transactions.length === 0 && !historyError ? (
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
                          {tx.creditsAfter != null && <p className="text-xs text-gray-500 dark:text-gray-400">
                            {t('credits.transactionTotal', { total: tx.creditsAfter })}
                          </p>}
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
            {referralEnabled && <ReferralLink />}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

