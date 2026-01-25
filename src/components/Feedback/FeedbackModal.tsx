/**
 * FeedbackModal Component
 *
 * Modal for submitting emoji ratings and testimonials.
 * Shows success state with credit notification.
 * Only displays testimonial field for positive ratings.
 */

import React, { useState, useCallback } from 'react';
import { X, Heart, Smile, Meh, Frown, Angry } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabase';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type EmojiRating = 'love' | 'happy' | 'neutral' | 'sad' | 'terrible';

interface EmojiOption {
  value: EmojiRating;
  label: string;
  icon: React.ReactNode;
  color: string;
}

const EMOJI_OPTIONS: EmojiOption[] = [
  {
    value: 'love',
    label: 'Love it! 💖',
    icon: <Heart className="w-8 h-8" />,
    color: 'text-red-500',
  },
  {
    value: 'happy',
    label: 'Happy 😊',
    icon: <Smile className="w-8 h-8" />,
    color: 'text-yellow-500',
  },
  {
    value: 'neutral',
    label: 'Neutral 😐',
    icon: <Meh className="w-8 h-8" />,
    color: 'text-gray-500',
  },
  {
    value: 'sad',
    label: 'Sad 😕',
    icon: <Frown className="w-8 h-8" />,
    color: 'text-blue-500',
  },
  {
    value: 'terrible',
    label: 'Terrible 👎',
    icon: <Angry className="w-8 h-8" />,
    color: 'text-purple-500',
  },
];

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [selectedRating, setSelectedRating] = useState<EmojiRating | null>(null);
  const [testimonial, setTestimonial] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal closes
  const handleClose = useCallback(() => {
    setSelectedRating(null);
    setTestimonial('');
    setSuccessMessage(null);
    setError(null);
    onClose();
  }, [onClose]);

  // Auto-close on success after 3 seconds
  React.useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(handleClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, handleClose]);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError('You must be logged in to submit feedback');
      return;
    }

    if (!selectedRating) {
      setError('Please select a rating');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Get the user's session token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error('Failed to get authentication token');
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
        throw new Error(errorData.error || 'Failed to submit feedback');
      }

      const result = await response.json();

      if (result.success) {
        let message = 'Thank you for your feedback!';

        if (result.credit.awarded) {
          message += ` You earned +1 credit! (${result.credit.creditsRemaining} remaining)`;
        } else if (result.credit.maxFeedbackCreditsReached) {
          message = 'Thank you! You\'ve already earned the max feedback credits.';
        }

        setSuccessMessage(message);
      } else {
        throw new Error('Unexpected response format');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to submit feedback';
      setError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  }, [user, selectedRating, testimonial]);

  if (!isOpen) return null;

  // Success state
  if (successMessage) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="text-5xl">✅</div>
            <p className="text-lg font-semibold text-center text-slate-900 dark:text-white">
              {successMessage}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
              Closing in 3 seconds...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Main feedback form
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            How's your experience?
          </h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Emoji rating selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Choose your rating:
            </label>
            <div className="grid grid-cols-5 gap-3">
              {EMOJI_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedRating(option.value)}
                  className={`
                    flex flex-col items-center gap-2 p-3 rounded-lg transition-all
                    ${
                      selectedRating === option.value
                        ? 'bg-emerald-50 dark:bg-emerald-900/30 border-2 border-emerald-600 dark:border-emerald-500'
                        : 'bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-600'
                    }
                  `}
                  aria-label={option.label}
                >
                  <div className={`${option.color}`}>{option.icon}</div>
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400 text-center">
                    {option.value}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Testimonial textarea (only for positive ratings) */}
          {selectedRating && (selectedRating === 'love' || selectedRating === 'happy') && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
              <label htmlFor="testimonial" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Tell us more (optional):
              </label>
              <textarea
                id="testimonial"
                value={testimonial}
                onChange={(e) => setTestimonial(e.target.value.slice(0, 500))}
                placeholder="What did you like most about Watheq?"
                className="
                  w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600
                  bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                  placeholder-slate-500 dark:placeholder-slate-400
                  focus:outline-none focus:ring-2 focus:ring-emerald-500
                  resize-none
                "
                rows={3}
              />
              <div className="text-xs text-slate-600 dark:text-slate-400 text-right">
                {testimonial.length}/500 characters
              </div>
            </div>
          )}

          {/* Submit button */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="
                flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600
                text-slate-700 dark:text-slate-300 font-medium
                hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              Skip
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedRating}
              className="
                flex-1 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700
                text-white font-medium transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              {isSubmitting ? 'Sending...' : 'Submit'}
            </button>
          </div>

          {/* Info text */}
          <p className="text-xs text-slate-600 dark:text-slate-400 text-center">
            💚 Positive feedback earns +1 credit (max 3 lifetime)
          </p>
        </form>
      </div>
    </div>
  );
};
