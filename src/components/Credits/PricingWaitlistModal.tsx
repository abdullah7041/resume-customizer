/**
 * PricingWaitlistModal
 *
 * Paid plans are NOT live. This modal validates pricing interest and collects
 * waitlist emails — there is no payment, billing, or checkout here. Styling
 * follows the Warm Saudi Premium direction: warm surfaces, calm emerald accents,
 * restrained gold, low-noise borders.
 */

import { createPortal } from 'react-dom';
import { useState, useEffect } from 'react';
import { Check, X, Mail, ListChecks } from 'lucide-react';
import { GlassButton } from '../ui/GlassButton';
import { GlassInput } from '../ui/GlassInput';
import { cn } from '../../lib/utils/cn';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../services/supabase';
import { analytics } from '../../services/analytics';

type PricingIntent = 'pack_9_sar' | 'monthly_29_sar' | 'not_sure';

interface PricingWaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  creditsRemaining: number;
  dismissKey: string;
  /** Where the modal was opened from — controls metadata + analytics source. */
  source?: 'pricing' | 'credits';
  /** Keep the pricing research question available without showing it in the launch flow. */
  showPricingIntentSurvey?: boolean;
}

export function PricingWaitlistModal({
  isOpen,
  onClose,
  creditsRemaining,
  dismissKey,
  source = 'pricing',
  showPricingIntentSurvey = false,
}: PricingWaitlistModalProps) {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState('');
  const [pricingIntent, setPricingIntent] = useState<PricingIntent | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (isOpen) setMounted(true);
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  // Source identifiers used for both metadata and analytics.
  const metadataSource = source === 'credits' ? 'pricing_waitlist_modal' : 'pricing_page';
  const analyticsSource = source === 'credits' ? 'low_credits_modal' : 'pricing_page';

  const intentOptions: { value: PricingIntent; label: string }[] = [
    { value: 'pack_9_sar', label: t('pricing.waitlist.intent.pack9Sar', '9 SAR application pack') },
    { value: 'monthly_29_sar', label: t('pricing.waitlist.intent.monthly29Sar', '29 SAR monthly while job searching') },
    { value: 'not_sure', label: t('pricing.waitlist.intent.notSure', 'Not sure yet') },
  ];

  const handleDismiss = () => {
    if (dismissKey) {
      localStorage.setItem(dismissKey, Date.now().toString());
    }
    onClose();
  };

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();

    if (!email || !email.includes('@')) {
      setSubmitError(t('pricing.waitlist.invalidEmail', 'Please enter a valid email address'));
      return;
    }

    const attemptKey = 'watheq:waitlistAttempts';
    const lastAttempt = localStorage.getItem(attemptKey);
    if (lastAttempt) {
      const timeSince = Date.now() - parseInt(lastAttempt);
      if (timeSince < 60000) {
        setSubmitError(t('pricing.waitlist.tooManyAttempts', 'Please wait a moment before trying again'));
        return;
      }
    }

    // Record the pricing signal only when the optional research question is shown.
    if (showPricingIntentSurvey && pricingIntent === 'pack_9_sar') {
      analytics.trackPricingIntentPack9Sar(analyticsSource);
    } else if (showPricingIntentSurvey && pricingIntent === 'monthly_29_sar') {
      analytics.trackPricingIntentMonthly29Sar(analyticsSource);
    }
    analytics.trackPricingIntent({ source: analyticsSource, planHint: 'pro' });

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // plan_type stays "pro" (constrained column); the chosen tier lives in metadata.
      const { error } = await supabase.from('waitlist').insert({
        email: email.toLowerCase().trim(),
        plan_type: 'pro',
        language: i18n.language,
        metadata: {
          source: metadataSource,
          pricing_intent: pricingIntent ?? 'not_provided',
          language: i18n.language,
          credits_remaining: source === 'credits' ? creditsRemaining : null,
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
        try {
          await fetch('/.netlify/functions/waitlist-confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.toLowerCase().trim(), language: i18n.language }),
          });
        } catch (emailError) {
          console.warn('[PricingWaitlistModal] Confirmation email failed:', emailError);
        }

        setSubmitSuccess(true);
        analytics.trackWaitlistJoined(analyticsSource);
        localStorage.setItem(attemptKey, Date.now().toString());
      }
    } catch (err) {
      console.error('[PricingWaitlistModal] Failed to join waitlist:', err);
      setSubmitError(t('pricing.waitlist.error', 'Failed to join waitlist. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const modal = (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6" dir={i18n.dir()}>
      {/* Calm backdrop */}
      <div
        className="absolute inset-0 bg-[color:var(--ink)]/35 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={handleDismiss}
        aria-hidden="true"
      />

      <div
        className="neu-card relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-[color:var(--glass-border)] shadow-xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pricing-waitlist-title"
      >
        {/* Restrained gold sheen at the top */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 rounded-t-3xl bg-gradient-to-b from-[color:var(--accent-gold-soft)] to-transparent" />

        <div className="relative p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--accent-gold)]/35 bg-[color:var(--accent-gold-soft)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#8a6d2f] dark:text-gold-400">
                <ListChecks className="h-3 w-3" />
                {t('pricing.waitlist.badge', 'Pricing Waitlist')}
              </span>
              <h2 id="pricing-waitlist-title" className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                {t('pricing.waitlist.title', 'Join the pricing waitlist')}
              </h2>
              <p className="max-w-sm text-sm leading-relaxed text-gray-600 dark:text-emerald-100/75">
                {t('pricing.waitlist.subtitle', 'Paid plans are not live yet. Join the list and help shape launch pricing.')}
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="shrink-0 rounded-full p-2 text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-900 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label={t('common.closeDialog', 'Close dialog')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {submitSuccess ? (
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-6 text-center animate-in zoom-in-95 duration-300">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20">
                <Check className="h-7 w-7 text-emerald-600 dark:text-emerald-300" />
              </div>
              <h3 className="mb-1 text-lg font-bold text-gray-900 dark:text-white">
                {t('pricing.waitlist.successTitle', "You're on the list")}
              </h3>
              <p className="text-sm text-emerald-700 dark:text-emerald-200/80">
                {t('pricing.waitlist.success', "We'll only notify you when pricing opens. No payment required.")}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div className="space-y-1.5">
                <label htmlFor="waitlist-email" className="ms-1 text-xs font-semibold text-gray-600 dark:text-emerald-100/70">
                  {t('pricing.waitlist.emailLabel', 'Your email')}
                </label>
                <GlassInput
                  id="waitlist-email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('pricing.emailPlaceholder', 'Enter your email')}
                  leftIcon={<Mail className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                  disabled={isSubmitting}
                />
              </div>

              {showPricingIntentSurvey && (
                <fieldset className="space-y-2">
                  <legend className="ms-1 text-xs font-semibold text-gray-600 dark:text-emerald-100/70">
                    {t('pricing.waitlist.intentLabel', 'Which pricing would you consider? (optional)')}
                  </legend>
                  <div className="space-y-2">
                    {intentOptions.map((option) => {
                      const checked = pricingIntent === option.value;
                      return (
                        <label
                          key={option.value}
                          className={cn(
                            'flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-colors',
                            checked
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-gray-900 dark:text-white'
                              : 'border-[color:var(--glass-border)] bg-[color:var(--surface-control)] text-gray-700 hover:bg-[color:var(--surface-control-hover)] dark:bg-white/5 dark:text-emerald-100/80 dark:hover:bg-white/10'
                          )}
                        >
                          <span
                            className={cn(
                              'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                              checked ? 'border-emerald-500' : 'border-gray-300 dark:border-white/30'
                            )}
                            aria-hidden="true"
                          >
                            {checked && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
                          </span>
                          <input
                            type="radio"
                            name="pricing-intent"
                            value={option.value}
                            checked={checked}
                            onChange={() => setPricingIntent(option.value)}
                            className="sr-only"
                          />
                          <span className="font-medium">{option.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              {submitError && (
                <p className="text-sm text-rose-600 dark:text-rose-300">{submitError}</p>
              )}

              <GlassButton
                type="submit"
                variant="primary"
                size="lg"
                disabled={isSubmitting || !email}
                className="w-full font-bold"
              >
                {isSubmitting
                  ? t('common.submitting', 'Sending...')
                  : t('pricing.waitlist.cta', 'Join pricing waitlist')}
              </GlassButton>

              <p className="text-center text-xs text-gray-500 dark:text-emerald-100/55">
                {t('pricing.waitlist.trust', "No payment required. We'll only notify you when pricing opens.")}
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

export default PricingWaitlistModal;
