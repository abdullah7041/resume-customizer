/**
 * useFeatureTracking Hook
 *
 * Advanced feature usage tracking with context collection (Best Practice 2026)
 * - Milestone-based feedback prompts (3rd, 15th, 40th use)
 * - Tracks feature sequence for user journey analysis
 * - Records session context for better insights
 * - Integrates with analytics and feedback system
 */

import { useCallback, useState, useEffect, useRef } from 'react';
import { useFeedbackPrompt } from '../lib/hooks/useFeedbackPrompt';
import { analytics } from '../services/analytics';

export type FeatureType = 'match' | 'optimize' | 'vision2030' | 'interview' | 'cover-letter';

const STORAGE_PREFIX = 'watheq:';
const FEATURE_SEQUENCE_KEY = `${STORAGE_PREFIX}feature_sequence`;
const LAST_FEATURE_KEY = `${STORAGE_PREFIX}last_feature`;
const SESSION_START_KEY = `${STORAGE_PREFIX}session_start`;

interface UseFeatureTrackingResult {
  trackFeatureUse: (feature: FeatureType) => boolean;
  shouldShowFeedback: boolean;
  dismissFeedback: () => void;
  featureUsesCount: number;
  currentMilestone: number | null;
  lastFeatureUsed: FeatureType | null;
  getSessionContext: () => SessionContext;
}

export interface SessionContext {
  last_feature_used: FeatureType | null;
  feature_sequence: FeatureType[];
  session_duration_seconds: number;
  total_lifetime_uses: number;
  current_milestone: number | null;
  user_segment: 'new_user' | 'casual_user' | 'regular_user' | 'power_user';
}

/**
 * Determine user segment based on feature usage count
 */
function getUserSegment(usageCount: number): SessionContext['user_segment'] {
  if (usageCount < 3) return 'new_user';
  if (usageCount < 10) return 'casual_user';
  if (usageCount < 50) return 'regular_user';
  return 'power_user';
}

/**
 * Track AI feature usage and manage milestone-based feedback prompts.
 *
 * @example
 * const { trackFeatureUse, shouldShowFeedback, getSessionContext } = useFeatureTracking();
 *
 * // After successful API call:
 * await optimizeResume();
 * trackFeatureUse('optimize');
 *
 * // Check if should show modal (with 5-10 second delay):
 * if (shouldShowFeedback) {
 *   setTimeout(() => setShowFeedbackModal(true), 5000 + Math.random() * 5000);
 * }
 */
export function useFeatureTracking(): UseFeatureTrackingResult {
  const {
    shouldShowFeedback,
    featureUsesCount,
    currentMilestone,
    incrementFeatureUses,
    dismissFeedback,
  } = useFeedbackPrompt();

  const [lastFeatureUsed, setLastFeatureUsed] = useState<FeatureType | null>(null);
  const sessionStartTime = useRef<number>(Date.now());

  // Initialize session start time from localStorage or create new
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SESSION_START_KEY);
      if (stored) {
        sessionStartTime.current = parseInt(stored, 10);
      } else {
        const now = Date.now();
        sessionStartTime.current = now;
        localStorage.setItem(SESSION_START_KEY, String(now));
      }
    } catch (error) {
      console.error('[useFeatureTracking] Failed to init session time:', error);
    }
  }, []);

  // Get feature sequence from localStorage
  const getFeatureSequence = useCallback((): FeatureType[] => {
    try {
      const stored = localStorage.getItem(FEATURE_SEQUENCE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('[useFeatureTracking] Failed to read feature sequence:', error);
    }
    return [];
  }, []);

  // Save feature to sequence (keep last 20 for performance)
  const addToFeatureSequence = useCallback((feature: FeatureType) => {
    try {
      const sequence = getFeatureSequence();
      sequence.push(feature);

      // Keep only last 20 features to prevent localStorage bloat
      const trimmed = sequence.slice(-20);
      localStorage.setItem(FEATURE_SEQUENCE_KEY, JSON.stringify(trimmed));
    } catch (error) {
      console.error('[useFeatureTracking] Failed to save feature sequence:', error);
    }
  }, [getFeatureSequence]);

  /**
   * Get comprehensive session context for feedback analytics
   */
  const getSessionContext = useCallback((): SessionContext => {
    const sessionDuration = Math.floor((Date.now() - sessionStartTime.current) / 1000);
    const featureSequence = getFeatureSequence();

    return {
      last_feature_used: lastFeatureUsed,
      feature_sequence: featureSequence,
      session_duration_seconds: sessionDuration,
      total_lifetime_uses: featureUsesCount,
      current_milestone: currentMilestone,
      user_segment: getUserSegment(featureUsesCount),
    };
  }, [lastFeatureUsed, featureUsesCount, currentMilestone, getFeatureSequence]);

  /**
   * Track a feature use and increment the counter.
   * Records feature in sequence and updates last used.
   */
  const trackFeatureUse = useCallback((feature: FeatureType): boolean => {
    // Update last feature used
    setLastFeatureUsed(feature);
    localStorage.setItem(LAST_FEATURE_KEY, feature);

    // Add to feature sequence
    addToFeatureSequence(feature);

    // Log to analytics with context
    const context = {
      feature_type: feature,
      timestamp: new Date().toISOString(),
      usage_count: featureUsesCount + 1,
      milestone: currentMilestone,
    };
    analytics.track('feature_used', context);

    // Increment the feedback prompt counter (checks for milestones)
    return incrementFeatureUses();
  }, [incrementFeatureUses, featureUsesCount, currentMilestone, addToFeatureSequence]);

  return {
    trackFeatureUse,
    shouldShowFeedback,
    dismissFeedback,
    featureUsesCount,
    currentMilestone,
    lastFeatureUsed,
    getSessionContext,
  };
}
