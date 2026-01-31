/**
 * ConfirmActionModal Component
 *
 * Confirmation dialog before expensive credit-consuming operations.
 * Shows credit cost, current balance, and insufficient credits warning with waitlist signup.
 */

import { createPortal } from 'react-dom';
import { useState } from 'react';
import { X, AlertTriangle, Sparkles, Mail, Crown, Check } from 'lucide-react';
import { GlassButton } from '../ui/GlassButton';
import { glass } from '../../lib/styles/glass';
import { cn } from '../../lib/utils/cn';
import { useTranslation } from 'react-i18next';
import { FEATURE_COSTS, FEATURE_LABELS, type FeatureName } from '../../types/credits';
import { supabase } from '../../services/supabase';

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
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!isOpen) return null;

  const cost = FEATURE_COSTS[feature];
  const canProceed = currentCredits >= cost;
  const featureLabel = FEATURE_LABELS[feature];

  const handleConfirm = async () => {
    await onConfirm();
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
                    {t('credits.upgrade.waitlistSuccess', "Thanks! We'll notify you when Pro launches.")}
                  </p>
                </div>
              ) : (
                <div className={cn(glass.card, 'p-4 border-gold-500/30')}>
                  <div className="flex items-center gap-2 mb-3">
                    <Crown className="w-4 h-4 text-gold-400" />
                    <p className="text-sm font-semibold text-gold-400">
                      {t('credits.upgrade.comingSoon', 'Pro Plan Coming Soon!')}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">
                    {t('credits.confirm.waitlistCta', 'Get 100 credits/mo when you join the Pro waitlist.')}
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
                          'bg-white/5 border border-white/10',
                          'text-white placeholder:text-gray-500',
                          'focus:outline-none focus:ring-2 focus:ring-emerald-500/50',
                          'transition-all duration-200'
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
                      {isSubmitting ? t('common.submitting', 'Sending...') : t('pricing.notify', 'Join Waitlist')}
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
