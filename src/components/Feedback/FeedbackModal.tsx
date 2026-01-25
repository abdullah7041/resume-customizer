/**
 * FeedbackModal Component
 *
 * Modal for submitting emoji ratings and testimonials.
 * Shows success state with credit notification.
 * Only displays testimonial field for positive ratings.
 * Supports Arabic/English with RTL layout.
 */

import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useUserCredits } from '../../hooks/useUserCredits';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../services/supabase';
import { GlassButton } from '../ui/GlassButton';
import { glass } from '../../lib/styles/glass';
import { cn } from '../../lib/utils/cn';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type EmojiRating = 'love' | 'happy' | 'neutral' | 'sad' | 'terrible';

interface EmojiOption {
  value: EmojiRating;
  emoji: string;
  labelEn: string;
  labelAr: string;
}

const EMOJI_OPTIONS: EmojiOption[] = [
  {
    value: 'love',
    emoji: '😍',
    labelEn: 'Love it!',
    labelAr: 'رائع!',
  },
  {
    value: 'happy',
    emoji: '😊',
    labelEn: 'Happy',
    labelAr: 'سعيد',
  },
  {
    value: 'neutral',
    emoji: '😐',
    labelEn: 'Okay',
    labelAr: 'عادي',
  },
  {
    value: 'sad',
    emoji: '😕',
    labelEn: 'Sad',
    labelAr: 'حزين',
  },
  {
    value: 'terrible',
    emoji: '😢',
    labelEn: 'Bad',
    labelAr: 'سيئ',
  },
];

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { refetch: refreshCredits } = useUserCredits();
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  const [selectedRating, setSelectedRating] = useState<EmojiRating | null>(null);
  const [testimonial, setTestimonial] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<{
    creditAwarded: boolean;
    creditsRemaining: number;
    maxReached: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal closes
  const handleClose = useCallback(() => {
    setSelectedRating(null);
    setTestimonial('');
    setSuccessData(null);
    setError(null);
    onClose();
  }, [onClose]);

  // Auto-close on success after 4 seconds
  React.useEffect(() => {
    if (successData) {
      const timer = setTimeout(handleClose, 4000);
      return () => clearTimeout(timer);
    }
  }, [successData, handleClose]);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError(isArabic ? 'يجب تسجيل الدخول أولاً' : 'You must be logged in to submit feedback');
      return;
    }

    if (!selectedRating) {
      setError(isArabic ? 'الرجاء اختيار تقييم' : 'Please select a rating');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Get the user's session token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error(isArabic ? 'فشل الحصول على رمز المصادقة' : 'Failed to get authentication token');
      }

      // Call the submit-feedback endpoint
      const response = await fetch('/.netlify/functions/submit-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          emoji_rating: selectedRating,
          testimonial_text: testimonial || undefined,
          context: 'web_ui',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || (isArabic ? 'فشل إرسال الملاحظات' : 'Failed to submit feedback'));
      }

      const result = await response.json();

      if (result.success) {
        setSuccessData({
          creditAwarded: result.credit.awarded,
          creditsRemaining: result.credit.creditsRemaining,
          maxReached: result.credit.maxFeedbackCreditsReached || false,
        });

        // Refresh credits in header
        await refreshCredits();
      } else {
        throw new Error(isArabic ? 'استجابة غير متوقعة' : 'Unexpected response format');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : (isArabic ? 'فشل إرسال الملاحظات' : 'Failed to submit feedback');
      setError(errorMsg);
      console.error('[FeedbackModal] Submit failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [user, selectedRating, testimonial, isArabic, refreshCredits]);

  if (!isOpen) return null;

  const isPositiveRating = selectedRating === 'love' || selectedRating === 'happy';

  // Success state
  if (successData) {
    const modal = (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-md"
          onClick={handleClose}
          aria-hidden="true"
        />

        {/* Success Modal */}
        <div
          className={cn(
            glass.elevated,
            'relative rounded-xl p-8 max-w-md w-full text-center',
            isArabic && 'rtl'
          )}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex flex-col items-center gap-4">
            <CheckCircle2 className="w-16 h-16 text-emerald-400" />

            <h3 className="text-xl font-bold text-white">
              {isArabic ? 'شكراً على ملاحظاتك!' : 'Thank you for your feedback!'}
            </h3>

            {successData.creditAwarded && (
              <div className={cn(glass.card, 'p-4 w-full border-emerald-500/30')}>
                <p className="text-emerald-400 font-semibold mb-1">
                  {isArabic ? '✅ +1 رصيد' : '✅ +1 Credit Added'}
                </p>
                <p className="text-sm text-gray-400">
                  {isArabic
                    ? `الرصيد الحالي: ${successData.creditsRemaining}`
                    : `Current balance: ${successData.creditsRemaining} credits`
                  }
                </p>
              </div>
            )}

            {successData.maxReached && (
              <p className="text-sm text-gray-400">
                {isArabic
                  ? 'لقد حصلت على الحد الأقصى من أرصدة الملاحظات (3)'
                  : 'You\'ve already earned max feedback credits (3)'}
              </p>
            )}

            <p className="text-xs text-gray-500">
              {isArabic ? 'سيتم الإغلاق خلال 4 ثوانٍ...' : 'Closing in 4 seconds...'}
            </p>
          </div>
        </div>
      </div>
    );

    return createPortal(modal, document.body);
  }

  // Main feedback form
  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-md"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={cn(
          glass.elevated,
          'relative rounded-xl max-w-md w-full',
          isArabic && 'rtl'
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <h3 id="feedback-title" className="text-lg font-semibold text-white">
              {isArabic ? 'كيف كانت تجربتك؟' : 'How was your experience?'}
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label={isArabic ? 'إغلاق' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error message */}
          {error && (
            <div className={cn(glass.card, 'p-3 border-red-500/30')}>
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Emoji rating selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300">
              {isArabic ? 'اختر تقييمك:' : 'Choose your rating:'}
            </label>
            <div className="grid grid-cols-5 gap-2">
              {EMOJI_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedRating(option.value)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-3 rounded-lg transition-all',
                    selectedRating === option.value
                      ? 'bg-emerald-500/20 border-2 border-emerald-500/50 scale-105'
                      : cn(glass.card, 'border-transparent hover:border-emerald-500/30 hover:scale-105')
                  )}
                  aria-label={isArabic ? option.labelAr : option.labelEn}
                  title={isArabic ? option.labelAr : option.labelEn}
                >
                  <div className="text-3xl">{option.emoji}</div>
                  <span className="text-xs font-medium text-gray-400 text-center">
                    {isArabic ? option.labelAr : option.labelEn}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Testimonial textarea (only for positive ratings) */}
          {selectedRating && isPositiveRating && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
              <label htmlFor="testimonial" className="block text-sm font-medium text-gray-300">
                {isArabic ? 'تبي تكتب شي نستخدمه كتوصية؟ (اختياري)' : 'Share a testimonial? (optional)'}
              </label>
              <textarea
                id="testimonial"
                value={testimonial}
                onChange={(e) => setTestimonial(e.target.value.slice(0, 500))}
                placeholder={isArabic ? 'وش أكثر شي عجبك في واثق؟' : 'What did you like most about Watheq?'}
                className={cn(
                  'w-full px-4 py-3 rounded-lg resize-none',
                  'bg-white/5 border border-white/10',
                  'text-white placeholder-gray-500',
                  'focus:outline-none focus:ring-2 focus:ring-emerald-500/50',
                  'transition-all'
                )}
                rows={3}
                dir={isArabic ? 'rtl' : 'ltr'}
              />
              <div className={cn(
                'text-xs text-gray-400',
                isArabic ? 'text-left' : 'text-right'
              )}>
                {testimonial.length}/500
              </div>
            </div>
          )}

          {/* Submit button */}
          <div className="flex gap-3 pt-4">
            <GlassButton
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              {isArabic ? 'تخطي' : 'Skip'}
            </GlassButton>
            <GlassButton
              type="submit"
              variant="primary"
              disabled={isSubmitting || !selectedRating}
              isLoading={isSubmitting}
              className="flex-1"
            >
              {isSubmitting
                ? (isArabic ? 'جاري الإرسال...' : 'Sending...')
                : (isArabic ? 'إرسال' : 'Submit')
              }
            </GlassButton>
          </div>

          {/* Info text */}
          <p className="text-xs text-gray-500 text-center">
            {isArabic
              ? '💚 الملاحظات الإيجابية تكسبك +1 رصيد (الحد الأقصى 3)'
              : '💚 Positive feedback earns +1 credit (max 3 lifetime)'
            }
          </p>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};
