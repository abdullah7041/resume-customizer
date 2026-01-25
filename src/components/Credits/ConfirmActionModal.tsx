/**
 * ConfirmActionModal Component
 *
 * Confirmation dialog before expensive credit-consuming operations.
 * Shows credit cost, current balance, and insufficient credits warning.
 */

import { createPortal } from 'react-dom';
import { X, AlertTriangle, Sparkles } from 'lucide-react';
import { GlassButton } from '../ui/GlassButton';
import { glass } from '../../lib/styles/glass';
import { cn } from '../../lib/utils/cn';
import { useTranslation } from 'react-i18next';
import { FEATURE_COSTS, FEATURE_LABELS, type FeatureName } from '../../types/credits';

interface ConfirmActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  feature: FeatureName;
  currentCredits: number;
  isLoading?: boolean;
}

export function ConfirmActionModal({
  isOpen,
  onClose,
  onConfirm,
  feature,
  currentCredits,
  isLoading = false,
}: ConfirmActionModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const cost = FEATURE_COSTS[feature];
  const canProceed = currentCredits >= cost;
  const featureLabel = FEATURE_LABELS[feature];

  const handleConfirm = async () => {
    await onConfirm();
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
          'relative rounded-xl p-6 max-w-md w-full'
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
              className="text-lg font-semibold text-white"
            >
              {t('credits.confirm.title')}
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

        {/* Content */}
        <div className="space-y-4">
          <div className={cn(glass.card, 'p-4')}>
            <p className="text-sm text-gray-400 mb-2">
              {featureLabel}
            </p>
            <p className="text-gray-300">
              {t('credits.confirm.message', { cost })}
            </p>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">
              {t('credits.confirm.current', {
                remaining: currentCredits,
                total: 15,
              })}
            </span>
            {canProceed && (
              <span className="text-emerald-400 font-medium">
                → {currentCredits - cost} {t('credits.remaining')}
              </span>
            )}
          </div>

          {/* Insufficient credits warning */}
          {!canProceed && (
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
            <GlassButton
              variant="primary"
              onClick={handleConfirm}
              disabled={!canProceed}
              isLoading={isLoading}
              className="flex-1"
            >
              {t('credits.confirm.continue', { cost })}
            </GlassButton>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
