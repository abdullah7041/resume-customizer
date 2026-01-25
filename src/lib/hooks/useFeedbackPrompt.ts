/**
 * useFeedbackPrompt Hook
 *
 * Tracks feature usage and determines when to show feedback prompt.
 * Shows feedback modal after 3 feature uses, prevents repeat prompts per session.
 */

import { useEffect, useState, useCallback } from 'react';

const STORAGE_PREFIX = 'watheq:';
const FEATURE_USES_KEY = `${STORAGE_PREFIX}feature_uses_count`;
const FEEDBACK_PROMPTED_KEY = `${STORAGE_PREFIX}feedback_prompted`;
const TRIGGER_THRESHOLD = 3; // Show feedback after 3 feature uses

interface UseFeedbackPromptResult {
  shouldShowFeedback: boolean;
  featureUsesCount: number;
  incrementFeatureUses: () => void;
  markFeedbackPrompted: () => void;
  dismissFeedback: () => void;
}

export function useFeedbackPrompt(): UseFeedbackPromptResult {
  const [shouldShowFeedback, setShouldShowFeedback] = useState(false);
  const [featureUsesCount, setFeatureUsesCount] = useState(0);

  // Initialize from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(FEATURE_USES_KEY);
      const alreadyPrompted = localStorage.getItem(FEEDBACK_PROMPTED_KEY) === 'true';

      const count = stored ? parseInt(stored, 10) : 0;
      setFeatureUsesCount(count);

      // Show feedback if threshold reached and not already prompted this session
      if (count >= TRIGGER_THRESHOLD && !alreadyPrompted) {
        setShouldShowFeedback(true);
        console.log('[useFeedbackPrompt] Feature usage threshold reached, showing feedback prompt');
      }
    } catch (error) {
      console.error('[useFeedbackPrompt] Failed to read from localStorage:', error);
    }
  }, []);

  // Increment feature usage count
  const incrementFeatureUses = useCallback(() => {
    try {
      const current = featureUsesCount + 1;
      setFeatureUsesCount(current);
      localStorage.setItem(FEATURE_USES_KEY, String(current));

      // Check if we've reached the threshold
      if (current >= TRIGGER_THRESHOLD) {
        const alreadyPrompted = localStorage.getItem(FEEDBACK_PROMPTED_KEY) === 'true';
        if (!alreadyPrompted) {
          setShouldShowFeedback(true);
          console.log('[useFeedbackPrompt] Feature usage threshold reached');
        }
      }
    } catch (error) {
      console.error('[useFeedbackPrompt] Failed to increment feature uses:', error);
    }
  }, [featureUsesCount]);

  // Mark that we've shown the feedback prompt (prevents repeat prompts this session)
  const markFeedbackPrompted = useCallback(() => {
    try {
      localStorage.setItem(FEEDBACK_PROMPTED_KEY, 'true');
      console.log('[useFeedbackPrompt] Feedback prompt marked');
    } catch (error) {
      console.error('[useFeedbackPrompt] Failed to mark feedback prompted:', error);
    }
  }, []);

  // Dismiss feedback (but don't reset usage count so it can show again on next session)
  const dismissFeedback = useCallback(() => {
    setShouldShowFeedback(false);
    markFeedbackPrompted();
    console.log('[useFeedbackPrompt] Feedback dismissed');
  }, [markFeedbackPrompted]);

  return {
    shouldShowFeedback,
    featureUsesCount,
    incrementFeatureUses,
    markFeedbackPrompted,
    dismissFeedback,
  };
}
