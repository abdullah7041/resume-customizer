/**
 * CreditsContext
 *
 * Provides shared credit state across the entire app.
 * Ensures CreditBalance in Header and modals always show the same values.
 */

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import type { UserCredits } from '../types/credits';

interface CreditsContextValue {
    credits: UserCredits | null;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    showUpgrade: boolean;
    setShowUpgrade: (show: boolean) => void;
    upgradeDismissedKey: string | null;
}

const CreditsContext = createContext<CreditsContextValue | undefined>(undefined);

interface CreditsProviderProps {
    children: ReactNode;
}

export function CreditsProvider({ children }: CreditsProviderProps) {
    const { user } = useAuth();
    const [credits, setCredits] = useState<UserCredits | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [showUpgrade, setShowUpgrade] = useState(false);
    const [upgradeDismissedKey, setUpgradeDismissedKey] = useState<string | null>(null);

    // Use ref to track previous credits for comparison (avoid infinite loop)
    const previousCreditsRef = useRef<UserCredits | null>(null);
    const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isFetchingRef = useRef(false);
    const hasLoadedOnceRef = useRef(false);

    const fetchCredits = useCallback(async (immediate = false) => {
        // Prevent concurrent fetches
        if (isFetchingRef.current && !immediate) {
            return;
        }
        if (!user) {
            setCredits(null);
            setIsLoading(false);
            isFetchingRef.current = false;
            return;
        }

        try {
            isFetchingRef.current = true;
            // Only show loading state on initial fetch to prevent layout shift
            if (!hasLoadedOnceRef.current) {
                setIsLoading(true);
            }
            const { data, error: fetchError } = await supabase
                .from('user_credits')
                .select('credits_remaining, credits_total, feedback_credits_earned, referral_credits_earned, last_reset_date')
                .eq('email', user.email)
                .single();

            if (fetchError) {
                // Handle "No rows found" (PGRST116) by defaulting to 0 credits
                if (fetchError.code === 'PGRST116') {
                    const defaultCredits = {
                        remaining: 0,
                        total: 0,
                        feedbackCreditsEarned: 0,
                        referralCreditsEarned: 0,
                        resetDate: new Date().toISOString(),
                    };
                    setCredits(defaultCredits);
                    previousCreditsRef.current = defaultCredits;
                    setError(null); // Clear any previous errors
                    return;
                }

                console.error('[CreditsContext] Fetch error:', {
                    message: fetchError.message,
                    details: fetchError.details,
                    hint: fetchError.hint,
                    code: fetchError.code,
                });
                throw fetchError;
            }

            if (data) {
                const newCredits = {
                    remaining: data.credits_remaining,
                    total: data.credits_total,
                    feedbackCreditsEarned: data.feedback_credits_earned,
                    referralCreditsEarned: data.referral_credits_earned || 0,
                    resetDate: data.last_reset_date,
                };

                // Detect referral credit increases using ref (not state)
                const prevCredits = previousCreditsRef.current;
                if (prevCredits && newCredits.referralCreditsEarned > prevCredits.referralCreditsEarned) {
                    const creditsAdded = (newCredits.referralCreditsEarned - prevCredits.referralCreditsEarned) * 5;
                    // Dispatch custom event for toast notification
                    window.dispatchEvent(new CustomEvent('referralCreditsEarned', {
                        detail: { creditsAdded }
                    }));
                }

                previousCreditsRef.current = newCredits;
                setCredits(newCredits);
            }
        } catch (err) {
            const error = err as any;

            // Enhanced error logging
            console.error('[CreditsContext] Failed to fetch credits:', {
                message: error?.message || 'Unknown error',
                details: error?.details || 'No details available',
                hint: error?.hint || '',
                code: error?.code || '',
            });

            // Only set error state for non-PGRST116 errors
            if (error?.code !== 'PGRST116') {
                // Keep previous credits if available to avoid UI flash
                if (!previousCreditsRef.current) {
                    setError(err instanceof Error ? err : new Error('Failed to fetch credits'));
                } else {
                    // Silently fail but keep showing previous data
                    console.warn('[CreditsContext] Using cached credits due to fetch failure');
                }
            }
        } finally {
            setIsLoading(false);
            isFetchingRef.current = false;
            hasLoadedOnceRef.current = true;
        }
    }, [user]);

    // Debounced version of fetchCredits for real-time updates
    const debouncedFetchCredits = useCallback(() => {
        // Clear any pending fetch
        if (fetchTimeoutRef.current) {
            clearTimeout(fetchTimeoutRef.current);
        }

        // Schedule a new fetch after 300ms of inactivity (faster updates)
        fetchTimeoutRef.current = setTimeout(() => {
            fetchCredits(false);
        }, 300);
    }, [fetchCredits]);

    // Initial fetch (immediate)
    useEffect(() => {
        fetchCredits(true);
    }, [fetchCredits]);

    // Real-time subscription with debouncing
    useEffect(() => {
        if (!user) return;

        const subscription = supabase
            .channel(`user_credits_global:${user.email}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'user_credits',
                    filter: `email=eq.${user.email}`,
                },
                (payload) => {
                    // Use debounced version to prevent rapid updates
                    debouncedFetchCredits();
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
            // Clear any pending debounced fetches
            if (fetchTimeoutRef.current) {
                clearTimeout(fetchTimeoutRef.current);
            }
        };
    }, [user, debouncedFetchCredits]);

    // Listen for manual credit refresh events (e.g., after referral tracking)
    useEffect(() => {
        const handleRefreshCredits = () => {
            fetchCredits(true); // Immediate fetch
        };

        window.addEventListener('refreshCredits', handleRefreshCredits);
        return () => {
            window.removeEventListener('refreshCredits', handleRefreshCredits);
        };
    }, [fetchCredits]);

    // Upgrade modal threshold logic
    useEffect(() => {
        if (!credits) return;

        const percentage = credits.total > 0 ? (credits.remaining / credits.total) * 100 : 0;

        // Determine threshold level
        let thresholdLevel = 0;
        if (credits.remaining === 0) {
            thresholdLevel = 0;
        } else if (percentage <= 10) {
            thresholdLevel = 10;
        } else if (percentage <= 25) {
            thresholdLevel = 25;
        }

        // Check if user dismissed this threshold
        const thresholdKey = `watheq:upgradeDismissed-${thresholdLevel}`;
        const dismissed = localStorage.getItem(thresholdKey);

        const shouldShow = thresholdLevel > 0 && !dismissed;

        if (shouldShow) {
            setUpgradeDismissedKey(thresholdKey);
            setShowUpgrade(true);
        }
    }, [credits]);

    const value: CreditsContextValue = {
        credits,
        isLoading,
        error,
        refetch: () => fetchCredits(true), // Always immediate when manually triggered
        showUpgrade,
        setShowUpgrade,
        upgradeDismissedKey,
    };

    return (
        <CreditsContext.Provider value={value}>
            {children}
        </CreditsContext.Provider>
    );
}

/**
 * Hook to access shared credits state
 */
export function useCredits(): CreditsContextValue {
    const context = useContext(CreditsContext);
    if (context === undefined) {
        throw new Error('useCredits must be used within a CreditsProvider');
    }
    return context;
}
