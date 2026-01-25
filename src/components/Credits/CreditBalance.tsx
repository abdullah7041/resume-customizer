/**
 * CreditBalance Component
 *
 * Displays credit balance in Header with color-coded visual feedback.
 * Clickable to open CreditUsageModal for detailed view.
 */

import { Coins } from 'lucide-react';
import { useUserCredits } from '../../hooks/useUserCredits';
import { glass } from '../../lib/styles/glass';
import { cn } from '../../lib/utils/cn';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';

interface CreditBalanceProps {
  onClick: () => void;
}

export function CreditBalance({ onClick }: CreditBalanceProps) {
  const { credits, isLoading } = useUserCredits();
  const { t } = useTranslation();

  // Calculate time until reset
  const timeUntilReset = useMemo(() => {
    if (!credits?.resetDate) return '';

    const resetDate = new Date(credits.resetDate);
    const now = new Date();
    const diffMs = resetDate.getTime() - now.getTime();

    if (diffMs <= 0) return 'Soon';

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
      return `${days}d ${hours}h`;
    }
    return `${hours}h`;
  }, [credits?.resetDate]);

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

  if (isLoading) {
    return (
      <div className="animate-pulse bg-white/5 h-9 w-32 rounded-lg" />
    );
  }

  if (!credits) return null;

  return (
    <button
      onClick={onClick}
      className={cn(
        glass.badge.neutral,
        colorClasses.border,
        'flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:bg-white/10',
        colorClasses.pulse
      )}
      aria-label={t('credits.balance')}
    >
      <Coins className={cn('w-4 h-4', colorClasses.icon)} />
      <div className="flex flex-col items-start">
        <span className={cn('text-sm font-medium', colorClasses.text)}>
          {credits.remaining} / {credits.total}
        </span>
        {timeUntilReset && (
          <span className="text-xs text-gray-400">
            {t('credits.resetsIn', { time: timeUntilReset })}
          </span>
        )}
      </div>
    </button>
  );
}
