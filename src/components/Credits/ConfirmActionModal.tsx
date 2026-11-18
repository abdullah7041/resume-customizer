/**
 * ConfirmActionModal Component
 *
 * Confirmation dialog before expensive credit-consuming operations.
 * Shows credit cost, current balance, and an option to buy credits when the balance is too low.
 */

import { createPortal } from 'react-dom';
import { X, AlertTriangle, Sparkles } from 'lucide-react';
import { GlassButton } from '../ui/GlassButton';
import { glass } from '../../lib/styles/glass';
import { cn } from '../../lib/utils/cn';
import { useTranslation } from 'react-i18next';
import { FEATURE_COSTS, FEATURE_LABELS, type FeatureName } from '../../types/credits';
import { useUserCredits } from '../../hooks/useUserCredits';
import { CreditPack } from '@/components/Credits/CreditPack';

interface ConfirmActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  feature: FeatureName;
  isLoading?: boolean;
  /** This particular call is a granted free allowance (e.g. the first
   * applied-subset re-score per job) — show free copy instead of the cost. */
  isFree?: boolean;
}

export function ConfirmActionModal({
  isOpen,
  onClose,
  onConfirm,
  feature,
  isLoading = false,
  isFree = false,
}: ConfirmActionModalProps) {
  const { t } = useTranslation();
  const { credits } = useUserCredits();
  const currentCredits = credits?.remaining || 0;
  const cost = isFree ? 0 : FEATURE_COSTS[feature];
  const canProceed = isFree || currentCredits >= cost;
  const featureLabel = FEATURE_LABELS[feature];

  if (!isOpen) return null;

  const handleConfirm = async () => {
    try {
      await onConfirm();
    } catch (err) {
      console.error('[ConfirmActionModal] onConfirm rejected:', err);
    }
  };

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={cn(
          glass.elevated,
          'relative max-h-[90vh] overflow-y-auto rounded-xl p-6 max-w-md w-full animate-in fade-in zoom-in-95 duration-200 ease-out'
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-action-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <h3
              id="confirm-action-title"
              className="text-lg font-semibold text-gray-900 dark:text-white"
            >
              {t('credits.confirm.title')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors"
            aria-label={t('common.closeDialog', 'Close dialog')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <div className={cn(glass.card, 'p-4')}>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {featureLabel}
            </p>
            <p className="text-gray-800 dark:text-gray-300">
              {isFree ? t('credits.confirm.freeMessage', 'Your first re-check for this job is free.') : t('credits.confirm.message', { cost })}
            </p>
          </div>

          {!isFree && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {t('credits.confirm.current', {
                  remaining: currentCredits,
                  total: credits?.total ?? 15,
                })}
              </span>
              {canProceed && (
                <span className="text-emerald-400 font-medium">
                  → {currentCredits - cost} {t('credits.remaining')}
                </span>
              )}
            </div>
          )}

          {/* Insufficient credits */}
          {!canProceed && (
            <div className="space-y-4">
              {/* Warning */}
              <div
                className={cn(
                  glass.card,
                  'flex items-start gap-2 p-3 border-red-500/30'
                )}
              >
                <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-400">
                  {t('credits.confirm.insufficient', {
                    required: cost,
                    available: currentCredits,
                  })}
                </p>
              </div>

              <CreditPack />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <GlassButton
              variant="secondary"
              onClick={onClose}
              className="flex-1"
              disabled={isLoading}
            >
              {t('common.cancel')}
            </GlassButton>
            {canProceed && (
              <GlassButton
                variant="primary"
                onClick={handleConfirm}
                disabled={!canProceed}
                isLoading={isLoading}
                className="flex-1"
              >
                {isFree ? t('credits.confirm.continueFree', 'Continue (free)') : t('credits.confirm.continue', { cost })}
              </GlassButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
