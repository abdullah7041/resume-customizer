import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Loader2, MessageSquare, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils/cn';
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

  if (!isOpen || !mounted) return null;

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
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" dir={i18n.dir()}>
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-md dark:bg-black/75" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-modal-title"
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#071f1a]"
      >
        <div className="flex items-center justify-between border-b border-gray-200 p-5 dark:border-white/10">
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

        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100">
            {rewardCopy}
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-gray-800 dark:text-white">
              {t('feedback.fields.type', 'Type')}
            </span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as FeedbackType)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/15 dark:bg-black/30 dark:text-white"
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
              className="w-full resize-none rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/15 dark:bg-black/30 dark:text-white"
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
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/15 dark:bg-black/30 dark:text-white"
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
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/15 dark:bg-black/30 dark:text-white"
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
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/15 dark:bg-black/30 dark:text-white"
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
            <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-100">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t('feedback.success', 'Thanks. Your feedback was submitted.')}</span>
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-white/15 dark:text-white/80 dark:hover:bg-white/10"
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
