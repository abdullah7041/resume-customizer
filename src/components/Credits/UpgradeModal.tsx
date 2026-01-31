/**
 * UpgradeModal Component - Premium Version (2026 Design)
 *
 * Promotes paid tier with high-end glassmorphism, animated borders,
 * and liquid gradients to maximize conversion and perceived value.
 */

import { createPortal } from 'react-dom';
import { useState, useEffect } from 'react';
import { Crown, X, Check, Mail, Bell, Sparkles, Star } from 'lucide-react';
import { GlassButton } from '../ui/GlassButton';
import { GlassInput } from '../ui/GlassInput';
import { cn } from '../../lib/utils/cn';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../services/supabase';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  creditsRemaining: number;
  dismissKey: string;
  source?: 'pricing' | 'credits';
}



export function UpgradeModal({
  isOpen,
  onClose,
  creditsRemaining,
  dismissKey,
  source = 'credits',
}: UpgradeModalProps) {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const PREMIUM_FEATURES = [
    { key: 'credits', value: t('credits.upgrade.features.credits', '100 credits/month'), icon: <Star className="w-3.5 h-3.5" /> },
    { key: 'support', value: t('credits.upgrade.features.support', 'Priority support'), icon: <Crown className="w-3.5 h-3.5" /> },
    { key: 'early_access', value: t('credits.upgrade.features.earlyAccess', 'Waitlist early access'), icon: <Sparkles className="w-3.5 h-3.5" /> },
  ];

  useEffect(() => {
    if (isOpen) setMounted(true);
  }, [isOpen]);

  if (!isOpen && !mounted) return null;

  if (!isOpen) return null;

  const handleDismiss = () => {
    if (dismissKey) {
      localStorage.setItem(dismissKey, Date.now().toString());
    }
    onClose();
  };

  const handleSubmitEmail = async (e: { preventDefault: () => void }) => {
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

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const { error } = await supabase.from('waitlist').insert({
        email: email.toLowerCase().trim(),
        plan_type: 'pro',
        language: i18n.language,
        metadata: {
          source: 'upgrade_modal',
          credits_remaining: creditsRemaining,
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
            body: JSON.stringify({
              email: email.toLowerCase().trim(),
              language: i18n.language
            })
          });
        } catch (emailError) {
          console.warn('[UpgradeModal] Confirmation email failed:', emailError);
        }

        setSubmitSuccess(true);
        localStorage.setItem(attemptKey, Date.now().toString());

        setTimeout(() => {
          handleDismiss();
        }, 3500);
      }
    } catch (err) {
      console.error('[UpgradeModal] Failed to join waitlist:', err);
      setSubmitError(t('pricing.waitlist.error', 'Failed to join waitlist. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Magic liquid background effect
  const liquidBg = "absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-gold-500/10 blur-3xl opacity-30 animate-[pulse_6s_ease-in-out_infinite]";

  const modal = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      {/* Cinematic Backdrop with blur and subtle zoom effect */}
      <div
        className="fixed inset-0 bg-[#000000]/80 backdrop-blur-xl animate-in fade-in duration-500"
        onClick={handleDismiss}
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(52,211,153,0.08),transparent_70%)] animate-pulse" />
      </div>

      {/* Main Modal Container - Premium Glass */}
      <div
        className={cn(
          "relative w-full max-w-lg overflow-hidden",
          "rounded-3xl", // Extra large rounding
          "bg-gray-900/90", // Base dark layer
          "shadow-[0_0_80px_-20px_rgba(245,158,11,0.15)]", // Ambient gold glow
          "animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 ease-out", // Smooth entrance
          "group" // For hover effects
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-title"
      >
        {/* Animated Border Container */}
        <div className="absolute inset-0 rounded-3xl p-[1px] overflow-hidden pointer-events-none">
          <div className="absolute inset-[-100%] animate-[spin_6s_linear_infinite] opacity-50 bg-[conic-gradient(from_0deg,transparent_0_300deg,var(--color-gold-500)_360deg)]" />
        </div>

        {/* Inner Content Container */}
        <div className="relative h-full bg-[#050505]/95 backdrop-blur-3xl rounded-[23px] overflow-hidden border border-white/5">
          {/* Liquid Background */}
          <div className={liquidBg} />

          {/* Top pattern */}
          <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-gold-500/5 to-transparent pointer-events-none" />

          <div className="relative p-6 sm:p-8 space-y-6">

            {/* Header Section */}
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-gradient-to-r from-gold-500/20 to-amber-500/20 text-gold-400 border border-gold-500/30 shadow-[0_0_15px_-3px_rgba(245,159,11,0.3)]">
                    <Sparkles className="w-3 h-3" />
                    {t('credits.upgrade.badge', 'EARLY ACCESS')}
                  </span>
                </div>
                <h2 id="upgrade-title" className="text-3xl font-bold text-white tracking-tight">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-gray-400">Unlock </span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-300 via-amber-200 to-gold-400 drop-shadow-[0_2px_10px_rgba(251,191,36,0.2)]">Pro</span>
                </h2>
                <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
                  {t('credits.upgrade.subtitle', 'Supercharge your resume optimization with higher limits and expert features.')}
                </p>
              </div>

              <button
                onClick={handleDismiss}
                className="group/close p-2 rounded-full hover:bg-white/5 transition-colors relative z-50"
              >
                <X className="w-5 h-5 text-gray-400 group-hover/close:text-white transition-colors" />
              </button>
            </div>

            {/* Low Credits Warning (Conditional) */}
            {source === 'credits' && (
              <div className="relative overflow-hidden rounded-xl bg-red-950/20 border border-red-500/20 p-4 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-red-500/10 rounded-lg shrink-0">
                    <Bell className="w-4 h-4 text-red-400 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-red-100">Low Credits Balance</h4>
                    <p className="text-xs text-red-300/80 mt-0.5">
                      {t('credits.upgrade.lowCredits', { remaining: creditsRemaining })}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Feature List - Premium Card */}
            <div className="bg-white/5 rounded-2xl border border-white/10 p-5 relative overflow-hidden group/card hover:bg-white/[0.07] transition-colors duration-300">
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none transform translate-x-1/3 -translate-y-1/3 transition-transform duration-700 group-hover/card:rotate-12">
                <Crown className="w-48 h-48" />
              </div>

              <h4 className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider text-[11px]">
                {t('credits.upgrade.proFeatures', 'What you get')}
              </h4>

              <ul className="space-y-3.5 relative z-10">
                {PREMIUM_FEATURES.map((feature) => (
                  <li key={feature.key} className="flex items-center gap-3 group/item">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 border border-white/10 flex items-center justify-center shrink-0 shadow-lg group-hover/item:border-emerald-500/30 transition-colors">
                      <div className="text-emerald-400 group-hover/item:scale-110 transition-transform duration-300">
                        {feature.icon ?? <Check className="w-4 h-4" />}
                      </div>
                    </div>
                    <span className="text-gray-200 font-medium text-sm group-hover/item:text-white transition-colors">{feature.value}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Interactive Form Section */}
            <div className="space-y-4 pt-2">
              {submitSuccess ? (
                <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-6 text-center animate-in zoom-in-95 duration-300">
                  <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 relative">
                    <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping opacity-75" />
                    <Check className="w-8 h-8 text-emerald-400 relative z-10" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">You're on the list!</h3>
                  <p className="text-emerald-400/80 text-sm">
                    {t('credits.upgrade.waitlistSuccess', "We'll notify you as soon as spots open up.")}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmitEmail} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 ml-1">
                      {t('credits.upgrade.emailLabel', 'Join the waitlist')}
                    </label>
                    <div className="relative group/input">
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-xl opacity-0 group-hover/input:opacity-100 transition-opacity duration-300 blur-md pointer-events-none" />
                      <GlassInput
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="example@email.com"
                        leftIcon={<Mail className="w-4 h-4 text-emerald-500" />}
                        className="bg-black/50 border-white/10 text-lg py-6 rounded-xl focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all pl-11 shadow-inner"
                        disabled={isSubmitting}
                      />
                    </div>
                    {submitError && (
                      <p className="text-red-400 text-xs pl-1 animate-in slide-in-from-left-1">{submitError}</p>
                    )}
                  </div>

                  <GlassButton
                    type="submit"
                    variant="prominent"
                    disabled={isSubmitting || !email}
                    className="w-full h-14 rounded-xl text-base font-bold shadow-[0_0_30px_-5px_rgba(16,185,129,0.3)] hover:shadow-[0_0_50px_-10px_rgba(16,185,129,0.5)] transition-all duration-300 border-t border-white/20 relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 -translate-x-full animate-[shimmer_2s_infinite]" />
                    <span className="flex items-center gap-2">
                      {isSubmitting ? (
                        <>Processing...</>
                      ) : (
                        <>
                          <Bell className="w-4 h-4 fill-current" />
                          {t('pricing.notify', 'Notify Me When Available')}
                        </>
                      )}
                    </span>
                  </GlassButton>
                </form>
              )}
            </div>

            {/* Footer / Tip */}
            {!submitSuccess && (
              <div className="flex items-center justify-center gap-2 text-[11px] text-gray-500 bg-white/5 rounded-full py-2 px-4 w-fit mx-auto border border-white/5 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse box-content border-2 border-[#050505]" />
                <span>{t('credits.upgrade.earnTip', 'Tip: You can earn more credits by referring friends!')}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
