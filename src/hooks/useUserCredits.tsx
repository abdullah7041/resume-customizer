/**
 * useUserCredits Hook
 *
 * Real-time credit data fetching with Supabase subscriptions.
 * Handles threshold checks for upgrade modal triggers.
 */

import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../services/supabase';
import type { UserCredits } from '../types/credits';

interface UseUserCreditsReturn {
  credits: UserCredits | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  showUpgrade: boolean;
  setShowUpgrade: (show: boolean) => void;
  upgradeDismissedKey: string | null;
}

export function useUserCredits(): UseUserCreditsReturn {
  const { user } = useAuth();
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeDismissedKey, setUpgradeDismissedKey] = useState<string | null>(null);

  const fetchCredits = async () => {
    if (!user) {
      setCredits(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('user_credits')
        .select('credits_remaining, credits_total, feedback_credits_earned, referral_credits_earned, last_reset_date')
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        console.error('[useUserCredits] Fetch error:', fetchError);
        throw fetchError;
      }

      if (data) {
        setCredits({
          remaining: data.credits_remaining,
          total: data.credits_total,
          feedbackCreditsEarned: data.feedback_credits_earned,
          referralCreditsEarned: data.referral_credits_earned || 0,
          resetDate: data.last_reset_date,
        });
      }
    } catch (err) {
      console.error('[useUserCredits] Failed to fetch credits:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch credits'));
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchCredits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const subscription = supabase
      .channel(`user_credits:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_credits',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          console.log('[useUserCredits] Real-time update detected, refetching...');
          fetchCredits();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Upgrade modal threshold logic
  useEffect(() => {
    if (!credits) return;

    const percentage = (credits.remaining / credits.total) * 100;

    // Determine threshold level (0, 25, 50, 75)
    let thresholdLevel = 0;
    if (percentage <= 25) {
      thresholdLevel = 25;
    } else if (percentage <= 10) {
      thresholdLevel = 10;
    } else if (credits.remaining === 0) {
      thresholdLevel = 0;
    }

    // Check if user dismissed this threshold
    const thresholdKey = `watheq:upgradeDismissed-${thresholdLevel}`;
    const dismissed = localStorage.getItem(thresholdKey);

    const shouldShow = thresholdLevel > 0 && !dismissed;

    if (shouldShow) {
      setUpgradeDismissedKey(thresholdKey);
      setShowUpgrade(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credits?.remaining, credits?.total]);

  return {
    credits,
    isLoading,
    error,
    refetch: fetchCredits,
    showUpgrade,
    setShowUpgrade,
    upgradeDismissedKey,
  };
}
