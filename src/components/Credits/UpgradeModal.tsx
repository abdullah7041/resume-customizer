/**
 * UpgradeModal Component
 *
 * Promotes paid tier when credits run low (75%, 90%, 100% thresholds).
 * Tracks dismissals per threshold in localStorage to avoid spam.
 */

import { createPortal } from 'react-dom';
import { Crown, X, Check } from 'lucide-react';
import { GlassButton } from '../ui/GlassButton';
import { glass } from '../../lib/styles/glass';
import { cn } from '../../lib/utils/cn';
import { useTranslation } from 'react-i18next';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  creditsRemaining: number;
  dismissKey: string;
}

const PREMIUM_FEATURES = [
  { key: 'credits', value: '100 credits/month' },
  { key: 'price', value: '35 SAR/month' },
  { key: 'support', value: 'Priority support' },
  { key: 'early_access', value: 'Early access to new features' },
];

export function UpgradeModal({
  isOpen,
  onClose,
  creditsRemaining,
  dismissKey,
}: UpgradeModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const handleDismiss = () => {
    if (dismissKey) {
      localStorage.setItem(dismissKey, Date.now().toString());
    }
    onClose();
  };

  const handleWaitlist = () => {
    window.open('https://tally.so/r/watheq-waitlist', '_blank');
    handleDismiss();
  };

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-md"
        onClick={handleDismiss}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={cn(
          glass.elevated,
          'relative rounded-xl p-6 max-w-md w-full border-gold-400/20'
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-gold-400" />
            <h3
              id="upgrade-modal-title"
              className="text-lg font-semibold text-white"
            >
              {t('credits.upgrade.title')}
            </h3>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {/* Low credits warning */}
          <div className={cn(glass.card, 'p-4 border-amber-500/30')}>
            <p className="text-gray-300">
              {t('credits.upgrade.lowCredits', { remaining: creditsRemaining })}
            </p>
          </div>

          {/* Premium features */}
          <div className={cn(glass.card, 'p-4 space-y-3')}>
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-4 h-4 text-gold-400" />
              <p className="text-sm font-semibold text-gold-400">
                {t('credits.upgrade.comingSoon')}
              </p>
            </div>

            <ul className="space-y-2">
              {PREMIUM_FEATURES.map((feature) => (
                <li
                  key={feature.key}
                  className="flex items-center gap-2 text-sm text-gray-300"
                >
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>{feature.value}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Earn credits tip */}
          <div className={cn(glass.card, 'p-3 border-emerald-500/30')}>
            <p className="text-xs text-emerald-400">
              💡 {t('credits.upgrade.earnTip')}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <GlassButton
              variant="secondary"
              onClick={handleDismiss}
              className="flex-1"
            >
              {t('common.dismiss')}
            </GlassButton>
            <GlassButton
              variant="prominent"
              onClick={handleWaitlist}
              leftIcon={<Crown className="w-4 h-4" />}
              className="flex-1"
            >
              {t('credits.upgrade.joinWaitlist')}
            </GlassButton>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
