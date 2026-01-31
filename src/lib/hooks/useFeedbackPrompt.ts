/**
 * useFeedbackPrompt Hook
 *
 * Milestone-based feedback system (Best Practice 2026)
 * Shows feedback at strategic intervals: 3rd, 15th, and 40th feature use
 * Prevents duplicate prompts for same milestone
 * Tracks feature context for analytics
 */

import { useEffect, useState, useCallback } from 'react';

const STORAGE_PREFIX = 'watheq:';
const FEATURE_USES_KEY = `${STORAGE_PREFIX}feature_uses_count`;
const PROMPTED_MILESTONES_KEY = `${STORAGE_PREFIX}prompted_milestones`;

// Strategic milestones based on user journey (Best Practice)
const PROMPT_MILESTONES = [3, 15, 40];

interface UseFeedbackPromptResult {
  shouldShowFeedback: boolean;
  featureUsesCount: number;
  currentMilestone: number | null;
  incrementFeatureUses: () => void;
  dismissFeedback: () => void;
}

export function useFeedbackPrompt(): UseFeedbackPromptResult {
  const [shouldShowFeedback, setShouldShowFeedback] = useState(false);
  const [featureUsesCount, setFeatureUsesCount] = useState(0);
  const [currentMilestone, setCurrentMilestone] = useState<number | null>(null);

  // Get prompted milestones from localStorage
  const getPromptedMilestones = useCallback((): Set<number> => {
    try {
      const stored = localStorage.getItem(PROMPTED_MILESTONES_KEY);
      if (stored) {
        return new Set(JSON.parse(stored));
      }
    } catch (error) {
      console.error('[useFeedbackPrompt] Failed to read prompted milestones:', error);
    }
    return new Set();
  }, []);

  // Save prompted milestone
  const markMilestonePrompted = useCallback((milestone: number) => {
    try {
      const prompted = getPromptedMilestones();
      prompted.add(milestone);
      localStorage.setItem(PROMPTED_MILESTONES_KEY, JSON.stringify([...prompted]));
      console.log(`[useFeedbackPrompt] Marked milestone ${milestone} as prompted`);
    } catch (error) {
      console.error('[useFeedbackPrompt] Failed to save prompted milestone:', error);
    }
  }, [getPromptedMilestones]);

  // Check if current count is a milestone that hasn't been shown
  const checkForMilestone = useCallback((count: number): number | null => {
    const prompted = getPromptedMilestones();

    // Find the milestone we just reached (if any)
    for (const milestone of PROMPT_MILESTONES) {
      if (count === milestone && !prompted.has(milestone)) {
        console.log(`[useFeedbackPrompt] 🎯 Reached milestone ${milestone}!`);
        return milestone;
      }
    }

    return null;
  }, [getPromptedMilestones]);

  // Initialize from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(FEATURE_USES_KEY);
      const count = stored ? parseInt(stored, 10) : 0;
      setFeatureUsesCount(count);

      // Check if we're at a milestone on mount (for page refresh scenarios)
      const milestone = checkForMilestone(count);
      if (milestone) {
        setCurrentMilestone(milestone);
        setShouldShowFeedback(true);
      }
    } catch (error) {
      console.error('[useFeedbackPrompt] Failed to initialize:', error);
    }
  }, [checkForMilestone]);

  // Increment feature usage count
  const incrementFeatureUses = useCallback(() => {
    try {
      const current = featureUsesCount + 1;
      setFeatureUsesCount(current);
      localStorage.setItem(FEATURE_USES_KEY, String(current));

      // Check if we've reached a new milestone
      const milestone = checkForMilestone(current);
      if (milestone) {
        setCurrentMilestone(milestone);
        setShouldShowFeedback(true);
        console.log(`[useFeedbackPrompt] Showing feedback for milestone ${milestone}`);
      }
    } catch (error) {
      console.error('[useFeedbackPrompt] Failed to increment feature uses:', error);
    }
  }, [featureUsesCount, checkForMilestone]);

  // Dismiss feedback and mark milestone as prompted
  const dismissFeedback = useCallback(() => {
    setShouldShowFeedback(false);

    if (currentMilestone !== null) {
      markMilestonePrompted(currentMilestone);
    }

    setCurrentMilestone(null);
    console.log('[useFeedbackPrompt] Feedback dismissed');
  }, [currentMilestone, markMilestonePrompted]);

  return {
    shouldShowFeedback,
    featureUsesCount,
    currentMilestone,
    incrementFeatureUses,
    dismissFeedback,
  };
}
