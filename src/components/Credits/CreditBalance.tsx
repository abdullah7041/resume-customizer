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
        border: 'border-emerald-500/30',
        text: 'text-emerald-400',
        icon: 'text-emerald-400',
        pulse: '',
      };
    } else if (percentage > 25) {
      return {
        border: 'border-amber-500/30',
        text: 'text-amber-400',
        icon: 'text-amber-400',
        pulse: '',
      };
    } else if (creditsRemaining >= 5) {
      return {
        border: 'border-red-500/30',
        text: 'text-red-400',
        icon: 'text-red-400',
        pulse: '',
      };
    } else {
      // Critical - pulsing animation
      return {
        border: 'border-red-500/50',
        text: 'text-red-400',
        icon: 'text-red-400',
        pulse: 'animate-pulse',
      };
    }
  }, [percentage, creditsRemaining]);

  const handleRefresh = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation(); // Prevent opening modal when clicking refresh
    setIsRefreshing(true);
    try {
      await refetch();
      console.log('[CreditBalance] Credits refreshed successfully');
    } catch (error) {
      console.error('[CreditBalance] Failed to refresh credits:', error);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse bg-white/5 h-9 w-32 rounded-lg" />
    );
  }

  if (!credits) return null;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onClick}
        className={cn(
          // Glassy dark background (more transparent as requested)
          'bg-black/40 backdrop-blur-md border border-white/10 items-center gap-3 px-4 py-2 rounded-xl transition-all shadow-lg',
          // colorClasses.border, // Removed solid border color to cleaner look, or keep subtle
          'hover:bg-black/50 hover:scale-105 active:scale-95',
          colorClasses.pulse
        )}
        aria-label={t('credits.balance')}
      >
        <div className={cn("p-1.5 rounded-full bg-white/5", colorClasses.text)}>
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
          'p-2 rounded-lg bg-black/40 backdrop-blur-md border border-white/10',
          'hover:bg-black/50 hover:scale-105 active:scale-95 transition-all',
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
