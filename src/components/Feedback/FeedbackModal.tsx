import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Loader2, MessageSquare, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils/cn';
import { useExitPresence } from '@/hooks/useExitPresence';
import { analytics } from '@/services/analytics';
import { buildFeedbackContext, submitFeedbackReport } from '@/services/feedback';
import type {
  FeedbackTrustToApply,
  FeedbackType,
  FeedbackWillingnessToPay,
  SubmitFeedbackResponse,
} from '@/types/feedback';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FEEDBACK_TYPES: FeedbackType[] = [
  'bug',
  'resume_quality',
  'confusing_ux',
  'feature_request',
  'pricing_credits',
  'other',
];

const MIN_MESSAGE_LENGTH = 30;

const TRUST_TO_APPLY_OPTIONS: FeedbackTrustToApply[] = ['yes', 'somewhat', 'no'];
const WILLINGNESS_TO_PAY_OPTIONS: FeedbackWillingnessToPay[] = ['yes', 'maybe', 'no'];
const fieldClassName =
  'w-full rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--surface-control)] px-3 py-2.5 text-gray-950 outline-none transition focus:border-[color:var(--focus-ring)] focus:bg-[color:var(--surface-glass-strong)] focus:ring-2 focus:ring-[color:var(--focus-ring)] dark:border-white/15 dark:bg-black/30 dark:text-white dark:focus:bg-black/50';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const { t, i18n } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [type, setType] = useState<FeedbackType>('bug');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState('');
  const [trustToApply, setTrustToApply] = useState('');
  const [willingnessToPay, setWillingnessToPay] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitFeedbackResponse | null>(null);
  const remainingCharacters = Math.max(0, MIN_MESSAGE_LENGTH - message.trim().length);
  const { shouldRender, isExiting } = useExitPresence(isOpen);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
  }, [isOpen]);

  const rewardCopy = useMemo(() => {
    if (!result) return t('feedback.reward.copy', 'Eligible first feedback earns +5 credits.');
    if (result.creditsAwarded > 0) {
      return t('feedback.reward.awarded', {
        credits: result.creditsAwarded,
        defaultValue: '+{{credits}} credits added to your balance.',
      });
    }
    if (result.rewardStatus === 'already_awarded') {
      return t(
        'feedback.reward.alreadyAwarded',
        'Thanks again. The +5 credit reward is available once per account.'
      );
    }
    return t('feedback.reward.notAwarded', 'Thanks. No credit reward was added for this report.');
  }, [result, t]);

  if (!shouldRender || !mounted) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (message.trim().length < MIN_MESSAGE_LENGTH) {
      setError(
        t('feedback.errors.messageTooShort', {
          count: remainingCharacters,
          defaultValue: 'Add {{count}} more characters so the report is useful.',
        })
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await submitFeedbackReport({
        type,
        message: message.trim(),
        rating: rating ? Number(rating) : null,
        validation: {
          trustToApply: trustToApply ? (trustToApply as FeedbackTrustToApply) : null,
          willingnessToPay: willingnessToPay ? (willingnessToPay as FeedbackWillingnessToPay) : null,
        },
      });
      analytics.trackFeedbackSubmitted({
        feedbackType: type,
        rating: rating ? Number(rating) : null,
        hasMessage: message.trim().length > 0,
        trustToApply: trustToApply ? (trustToApply as FeedbackTrustToApply) : null,
        willingnessToPay: willingnessToPay ? (willingnessToPay as FeedbackWillingnessToPay) : null,
        contextFeature: buildFeedbackContext().contextFeature,
      });
      setResult(response);
      setMessage('');
      setRating('');
      setTrustToApply('');
      setWillingnessToPay('');
      if (response.creditsAwarded > 0) {
        window.dispatchEvent(new Event('refreshCredits'));
      }
    } catch (submitError) {
      setError(
        getErrorMessage(
          submitError,
          t('feedback.errors.submitFailed', 'We could not submit feedback right now.')
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const modal = (
    <div
      className={cn(
        'fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-4',
        isExiting && 'pointer-events-none'
      )}
      dir={i18n.dir()}
      aria-hidden={isExiting || undefined}
      inert={isExiting}
    >
      <div
        className={cn(
          'absolute inset-0 bg-gray-900/60 backdrop-blur-md dark:bg-black/75 duration-200',
          isExiting ? 'animate-out fade-out ease-out' : 'animate-in fade-in'
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-modal-title"
        className={cn(
          'relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--surface-glass-elevated)] shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#071f1a] duration-200 ease-out',
          isExiting ? 'animate-out fade-out zoom-out-95' : 'animate-in fade-in zoom-in-95'
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[color:var(--glass-border)] p-5 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h2 id="feedback-modal-title" className="text-lg font-bold text-gray-950 dark:text-white">
                {t('feedback.title', 'Send feedback')}
              </h2>
              <p className="text-sm text-gray-600 dark:text-white/65">
                {t('feedback.subtitle', 'Report a bug, confusing step, or product idea.')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-950 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label={t('common.closeDialog', 'Close dialog')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="glass-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm font-medium text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100">
              {rewardCopy}
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-gray-800 dark:text-white">
                {t('feedback.fields.type', 'Type')}
              </span>
              <select
                value={type}
                onChange={(event) => setType(event.target.value as FeedbackType)}
                className={fieldClassName}
              >
                {FEEDBACK_TYPES.map((feedbackType) => (
                  <option key={feedbackType} value={feedbackType}>
                    {t(`feedback.types.${feedbackType}`)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-gray-800 dark:text-white">
                {t('feedback.fields.message', 'What felt wrong, generic, or confusing?')}
              </span>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={6}
                maxLength={4000}
                placeholder={t('feedback.fields.messagePlaceholder', 'Tell us what felt off and what you expected instead.')}
                className={cn(fieldClassName, 'resize-none')}
              />
              <span className={cn('mt-1 block text-xs', remainingCharacters > 0 ? 'text-gray-500 dark:text-white/55' : 'text-emerald-700 dark:text-emerald-300')}>
                {remainingCharacters > 0
                  ? t('feedback.fields.minimumRemaining', {
                      count: remainingCharacters,
                      defaultValue: '{{count}} more characters needed',
                    })
                  : t('feedback.fields.minimumMet', 'Looks detailed enough.')}
              </span>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-gray-800 dark:text-white">
                {t('feedback.fields.trustToApply', 'Would you trust this resume enough to apply?')}
              </span>
              <select
                value={trustToApply}
                onChange={(event) => setTrustToApply(event.target.value)}
                className={fieldClassName}
              >
                <option value="">{t('feedback.fields.noAnswer', 'No answer')}</option>
                {TRUST_TO_APPLY_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {t(`feedback.trustToApply.${value}`)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-gray-800 dark:text-white">
                {t('feedback.fields.willingnessToPay', 'Would you pay for this if it saved you time?')}
              </span>
              <select
                value={willingnessToPay}
                onChange={(event) => setWillingnessToPay(event.target.value)}
                className={fieldClassName}
              >
                <option value="">{t('feedback.fields.noAnswer', 'No answer')}</option>
                {WILLINGNESS_TO_PAY_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {t(`feedback.willingnessToPay.${value}`)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-gray-800 dark:text-white">
                {t('feedback.fields.rating', 'Rating (optional)')}
              </span>
              <select
                value={rating}
                onChange={(event) => setRating(event.target.value)}
                className={fieldClassName}
              >
                <option value="">{t('feedback.fields.noRating', 'No rating')}</option>
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {t('feedback.fields.ratingValue', {
                      count: value,
                      defaultValue: '{{count}} / 5',
                    })}
                  </option>
                ))}
              </select>
            </label>

            {error && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200">
                {error}
              </div>
            )}

            {result && (
              <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-100">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{t('feedback.success', 'Thanks. Your feedback was submitted.')}</span>
              </div>
            )}
          </div>

          <div className="sticky bottom-0 z-10 flex shrink-0 flex-col-reverse gap-3 border-t border-[color:var(--glass-border)] bg-[color:var(--surface-glass-elevated)] p-4 backdrop-blur-xl sm:flex-row sm:justify-end dark:border-white/10 dark:bg-[#071f1a]/95">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[color:var(--glass-border)] px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-[color:var(--surface-control-hover)] dark:border-white/15 dark:text-white/80 dark:hover:bg-white/10"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? t('feedback.submitting', 'Submitting...') : t('feedback.submit', 'Submit feedback')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
