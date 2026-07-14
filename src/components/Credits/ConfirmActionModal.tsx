/**
 * ConfirmActionModal Component
 *
 * Confirmation dialog before expensive credit-consuming operations.
 * Shows credit cost, current balance, and insufficient credits warning with waitlist signup.
 */

import { createPortal } from 'react-dom';
import { useState } from 'react';
import { X, AlertTriangle, Sparkles, Mail, ListChecks, Check } from 'lucide-react';
import { GlassButton } from '../ui/GlassButton';
import { glass } from '../../lib/styles/glass';
import { cn } from '../../lib/utils/cn';
import { useTranslation } from 'react-i18next';
import { FEATURE_COSTS, FEATURE_LABELS, type FeatureName } from '../../types/credits';
import { supabase } from '../../services/supabase';
import { useUserCredits } from '../../hooks/useUserCredits';
import { analytics } from '../../services/analytics';

interface ConfirmActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  feature: FeatureName;
  isLoading?: boolean;
}

export function ConfirmActionModal({
  isOpen,
  onClose,
  onConfirm,
  feature,
  isLoading = false,
}: ConfirmActionModalProps) {
  const { t, i18n } = useTranslation();
  const { credits } = useUserCredits();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const currentCredits = credits?.remaining || 0;
  const cost = FEATURE_COSTS[feature];
  const canProceed = currentCredits >= cost;
  const featureLabel = FEATURE_LABELS[feature];

  if (!isOpen) return null;

  const handleConfirm = async () => {
    try {
      await onConfirm();
    } catch (err) {
      console.error('[ConfirmActionModal] onConfirm rejected:', err);
    }
  };

  const handleSubmitWaitlist = async (e: { preventDefault: () => void }) => {
    e.preventDefault();

    if (!email || !email.includes('@')) {
      setSubmitError(t('pricing.waitlist.invalidEmail', 'Please enter a valid email address'));
      return;
    }

    // Basic abuse prevention
    const attemptKey = 'watheq:waitlistAttempts';
    const lastAttempt = localStorage.getItem(attemptKey);
    if (lastAttempt) {
      const timeSince = Date.now() - parseInt(lastAttempt);
      if (timeSince < 60000) {
        setSubmitError(t('pricing.waitlist.tooManyAttempts', 'Please wait a moment before trying again'));
        return;
      }
    }

    analytics.trackPricingIntent({ source: 'insufficient_credits_modal', planHint: 'pro' });

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const { error } = await supabase.from('waitlist').insert({
        email: email.toLowerCase().trim(),
        plan_type: 'pro',
        language: i18n.language,
        metadata: {
          source: 'insufficient_credits',
          feature_attempted: feature,
          credits_remaining: currentCredits,
          timestamp: new Date().toISOString(),
        },
      });

      if (error) {
        if (error.code === '23505') {
          setSubmitError(t('pricing.waitlist.alreadyJoined', "You're already on the waitlist!"));
        } else {
          throw error;
        }
      } else {
        // Send confirmation email
        try {
          await fetch('/.netlify/functions/waitlist-confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: email.toLowerCase().trim(),
              language: i18n.language,
            }),
          });
        } catch (emailError) {
          console.warn('[ConfirmActionModal] Confirmation email failed:', emailError);
        }

        setSubmitSuccess(true);
        analytics.trackWaitlistJoined('insufficient_credits_modal');
        localStorage.setItem(attemptKey, Date.now().toString());
      }
    } catch (err) {
      console.error('[ConfirmActionModal] Failed to join waitlist:', err);
      setSubmitError(t('pricing.waitlist.error', 'Failed to join waitlist. Please try again.'));
    } finally {
      setIsSubmitting(false);
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
          'relative rounded-xl p-6 max-w-md w-full animate-in fade-in zoom-in-95 duration-200 ease-out'
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
              {t('credits.confirm.message', { cost })}
            </p>
          </div>

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

          {/* Insufficient credits - Show waitlist signup */}
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

              {/* Waitlist Signup */}
              {submitSuccess ? (
                <div className={cn(glass.card, 'p-4 border-emerald-500/30 text-center')}>
                  <Check className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-emerald-400 font-medium">
                    {t('pricing.waitlist.success', "We'll only notify you when pricing opens. No payment required.")}
                  </p>
                </div>
              ) : (
                <div className={cn(glass.card, 'p-4 border-gold-500/30')}>
                  <div className="flex items-center gap-2 mb-3">
                    <ListChecks className="w-4 h-4 text-gold-400" />
                    <p className="text-sm font-semibold text-gold-400">
                      {t('pricing.waitlist.title', 'Join the pricing waitlist')}
                    </p>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                    {t('pricing.waitlist.subtitle', 'Paid plans are not live yet. Join the list and help shape launch pricing.')}
                  </p>
                  <form onSubmit={handleSubmitWaitlist} className="space-y-2">
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t('pricing.emailPlaceholder', 'Enter your email')}
                        className={cn(
                          'w-full pl-10 pr-4 py-2 rounded-lg text-sm',
                          'bg-gray-100/50 dark:bg-white/5 border border-gray-300 dark:border-white/10',
                          'text-gray-900 dark:text-white placeholder:text-gray-500',
                          'focus:outline-none focus:ring-2 focus:ring-emerald-500/50',
                          'transition-shadow duration-200'
                        )}
                        disabled={isSubmitting}
                        required
                      />
                    </div>
                    <GlassButton
                      type="submit"
                      variant="prominent"
                      disabled={isSubmitting || !email}
                      className="w-full"
                      size="sm"
                    >
                      {isSubmitting ? t('common.submitting', 'Sending...') : t('pricing.waitlist.cta', 'Join pricing waitlist')}
                    </GlassButton>
                    {submitError && (
                      <p className="text-red-400 text-xs">{submitError}</p>
                    )}
                  </form>
                </div>
              )}
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
                {t('credits.confirm.continue', { cost })}
              </GlassButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
