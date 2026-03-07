/**
 * CreditBalance Component
 *
 * Displays credit balance in Header with color-coded visual feedback.
 * Clickable to open CreditUsageModal for detailed view.
 */

import { Coins, RefreshCw } from 'lucide-react';
import { useUserCredits } from '../../hooks/useUserCredits';
import { cn } from '../../lib/utils/cn';
import { useTranslation } from 'react-i18next';
import { useMemo, useState, type MouseEvent } from 'react';

interface CreditBalanceProps {
  onClick: () => void;
}

export function CreditBalance({ onClick }: CreditBalanceProps) {
  const { credits, isLoading, refetch } = useUserCredits();
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Calculate time until next reset (30 days from last_reset_date)
  const resetInfo = useMemo(() => {
    if (!credits?.resetDate) return { daysRemaining: 0, dateText: '' };

    const lastReset = new Date(credits.resetDate);
    const nextReset = new Date(lastReset.getTime() + 30 * 24 * 60 * 60 * 1000); // Add 30 days
    const now = new Date();
    const diffMs = nextReset.getTime() - now.getTime();

    // Format the date based on locale
    const locale = isArabic ? 'ar-SA' : 'en-US';
    const dateText = nextReset.toLocaleDateString(locale, { month: 'short', day: 'numeric' });

    if (diffMs <= 0) return { daysRemaining: 0, dateText };

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    return { daysRemaining: days, dateText };
  }, [credits?.resetDate, isArabic]);

  // Color coding based on percentage
  const percentage = credits ? (credits.remaining / credits.total) * 100 : 0;
  const creditsRemaining = credits?.remaining || 0;

  const colorClasses = useMemo(() => {
    if (percentage > 50) {
      return {
        border: 'border-emerald-300 dark:border-emerald-500/30',
        text: 'text-emerald-700 dark:text-emerald-400',
        icon: 'text-emerald-600 dark:text-emerald-400',
        pulse: '',
      };
    } else if (percentage > 25) {
      return {
        border: 'border-amber-300 dark:border-amber-500/30',
        text: 'text-amber-700 dark:text-amber-400',
        icon: 'text-amber-600 dark:text-amber-400',
        pulse: '',
      };
    } else if (creditsRemaining >= 5) {
      return {
        border: 'border-red-300 dark:border-red-500/30',
        text: 'text-red-700 dark:text-red-400',
        icon: 'text-red-600 dark:text-red-400',
        pulse: '',
      };
    } else {
      // Critical - pulsing animation
      return {
        border: 'border-red-500 dark:border-red-500/50',
        text: 'text-red-700 dark:text-red-400',
        icon: 'text-red-600 dark:text-red-400',
        pulse: 'animate-pulse',
      };
    }
  }, [percentage, creditsRemaining]);

  const handleRefresh = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation(); // Prevent opening modal when clicking refresh
    setIsRefreshing(true);
    try {
      await refetch();
    } catch (error) {
      console.error('[CreditBalance] Failed to refresh credits:', error);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse bg-white/5 h-9 w-32 min-w-[140px] rounded-lg" />
    );
  }

  if (!credits) return null;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onClick}
        className={cn(
          // Glassy dark/light background
          'bg-white/90 dark:bg-black/40 backdrop-blur-md border border-gray-300 dark:border-white/10 flex items-center gap-3 px-4 py-2 rounded-xl transition-all shadow-sm',
          colorClasses.border, // Optional solid border color
          'hover:bg-gray-100 dark:hover:bg-black/50 hover:scale-[1.02] active:scale-[0.98]',
          colorClasses.pulse
        )}
        aria-label={t('credits.balance')}
      >
        <div className={cn("p-1.5 rounded-full bg-gray-100 dark:bg-white/5", colorClasses.text)}>
          <Coins className="w-4 h-4" />
        </div>

        <div className="flex flex-col items-start gap-0.5">
          <span className={cn('text-sm font-extrabold tracking-wide', colorClasses.text)}>
            {credits.remaining} / {credits.total}
          </span>
          {resetInfo.dateText && (
            <span className={cn(
              "text-[10px] uppercase tracking-wider font-bold opacity-80",
              colorClasses.text
            )}>
              {resetInfo.daysRemaining <= 0
                ? t('credits.resetsSoon', 'Resets soon')
                : t('credits.resetsInWithDate', { days: resetInfo.daysRemaining, date: resetInfo.dateText })}
            </span>
          )}
        </div>
      </button>

      {/* Refresh Button */}
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className={cn(
          'p-2 rounded-lg bg-white/90 dark:bg-black/40 backdrop-blur-md border border-gray-300 dark:border-white/10 shadow-sm',
          'hover:bg-gray-100 dark:hover:bg-black/50 hover:scale-[1.02] active:scale-[0.98] transition-all',
          isRefreshing && 'animate-spin'
        )}
        aria-label="Refresh credits"
        title="Refresh credits"
      >
        <RefreshCw className={cn('w-4 h-4', colorClasses.icon)} />
      </button>
    </div>
  );
}
