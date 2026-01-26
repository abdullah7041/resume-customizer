/**
 * CreditBalance Component
 *
 * Displays credit balance in Header with color-coded visual feedback.
 * Clickable to open CreditUsageModal for detailed view.
 */

import { Coins } from 'lucide-react';
import { useUserCredits } from '../../hooks/useUserCredits';
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
        {timeUntilReset && (
          <span className={cn(
            "text-[10px] uppercase tracking-wider font-bold opacity-80",
            colorClasses.text
          )}>
            {timeUntilReset === 'Soon'
              ? t('credits.resetsSoon', 'Resets soon')
              : t('credits.resetsIn', { time: timeUntilReset })}
          </span>
        )}
      </div>
    </button>
  );
}
