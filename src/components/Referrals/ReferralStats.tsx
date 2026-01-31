/**
 * ReferralStats Component
 *
 * Displays referral statistics:
 * - Total referrals made
 * - Completed referrals (earned credits)
 * - Total credits earned from referrals
 */

import { useState, useEffect } from 'react';
import { Users, CheckCircle, Coins } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { glass } from '../../lib/styles/glass';
import { cn } from '../../lib/utils/cn';
import { useTranslation } from 'react-i18next';

interface ReferralStatsProps {
  className?: string;
}

interface Stats {
  totalReferrals: number;
  completedReferrals: number;
  creditsEarned: number;
}

export function ReferralStats({ className }: ReferralStatsProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function fetchStats() {
      try {
        const response = await fetch(`/.netlify/functions/referral-api?action=get-stats&user_id=${user.id}`);
        const data = await response.json();

        if (data.success) {
          setStats({
            totalReferrals: data.totalReferrals,
            completedReferrals: data.completedReferrals,
            creditsEarned: data.creditsEarned,
          });
        }
      } catch (error) {
        console.error('[ReferralStats] Failed to fetch stats:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
  }, [user]);

  if (isLoading) {
    return (
      <div className={cn(glass.card, 'p-4 space-y-3 animate-pulse', className)}>
        <div className="h-4 bg-white/10 rounded w-1/2" />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-16 bg-white/10 rounded" />
          <div className="h-16 bg-white/10 rounded" />
          <div className="h-16 bg-white/10 rounded" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className={cn(glass.card, 'p-4 text-center', className)}>
        <p className="text-sm text-gray-400">
          {t('referrals.statsUnavailable')}
        </p>
      </div>
    );
  }

  const statItems = [
    {
      icon: Users,
      label: t('referrals.totalReferrals'),
      value: stats.totalReferrals,
      color: 'text-blue-400',
      bgColor: 'from-blue-500/20 to-blue-500/10',
    },
    {
      icon: CheckCircle,
      label: t('referrals.completedReferrals'),
      value: stats.completedReferrals,
      color: 'text-emerald-400',
      bgColor: 'from-emerald-500/20 to-emerald-500/10',
    },
    {
      icon: Coins,
      label: t('referrals.creditsEarned'),
      value: `+${stats.creditsEarned}`,
      color: 'text-amber-400',
      bgColor: 'from-amber-500/20 to-amber-500/10',
    },
  ];

  return (
    <div className={cn(glass.card, 'p-4 space-y-3', className)}>
      {/* Header */}
      <h4 className="text-sm font-semibold text-white">
        {t('referrals.yourStats')}
      </h4>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        {statItems.map((item) => (
          <div
            key={item.label}
            className={cn(
              'relative overflow-hidden rounded-lg p-3 border border-white/10',
              'bg-gradient-to-br',
              item.bgColor
            )}
          >
            <div className="flex flex-col items-center text-center">
              <item.icon className={cn('w-5 h-5 mb-1', item.color)} />
              <p className={cn('text-lg font-bold', item.color)}>
                {item.value}
              </p>
              <p className="text-[10px] text-gray-400 leading-tight mt-1">
                {item.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Info message */}
      {stats.totalReferrals === 0 ? (
        <p className="text-xs text-gray-400 text-center pt-2">
          {t('referrals.noReferralsYet')}
        </p>
      ) : stats.completedReferrals < stats.totalReferrals ? (
        <p className="text-xs text-gray-400 text-center pt-2">
          {t('referrals.pendingReferrals', {
            count: stats.totalReferrals - stats.completedReferrals,
          })}
        </p>
      ) : (
        <p className="text-xs text-emerald-400 text-center pt-2">
          {t('referrals.allCompleted')}
        </p>
      )}
    </div>
  );
}
