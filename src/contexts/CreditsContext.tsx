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
const CREDITS_CACHE_TTL_MS = 1000;

interface UserCreditsRow {
    credits_remaining: number;
    credits_total: number;
    feedback_credits_earned: number;
    referral_credits_earned: number | null;
    last_reset_date: string;
    signup_metadata: { pending_initial_grant?: boolean } | null;
}

interface UserCreditsApiResponse {
    creditsRemaining: number;
    creditsTotal: number;
    feedbackCreditsEarned: number;
    referralCreditsEarned: number;
    lastResetDate: string | null;
}

interface CreditsCacheEntry {
    fetchedAt: number;
    credits: UserCredits;
}

const inFlightCreditsFetches = new Map<string, Promise<UserCredits>>();
const recentCreditsByEmail = new Map<string, CreditsCacheEntry>();

const mapCreditsRow = (data: UserCreditsRow): UserCredits => ({
    remaining: data.credits_remaining,
    total: data.credits_total,
    feedbackCreditsEarned: data.feedback_credits_earned,
    referralCreditsEarned: data.referral_credits_earned || 0,
    resetDate: data.last_reset_date,
});

const getDefaultCredits = (): UserCredits => ({
    remaining: 0,
    total: 0,
    feedbackCreditsEarned: 0,
    referralCreditsEarned: 0,
    resetDate: new Date().toISOString(),
});

/**
 * A row flagged `pending_initial_grant` always reads as zero credits: the signup
 * trigger creates it empty and only the server may issue the grant, after its
 * IP-abuse and email-verification checks. Reading the table alone would leave a
 * new user at zero with every credit-gated action disabled, so resolve the grant
 * server-side and use that balance instead. Failure is non-fatal — the caller
 * falls back to the (zero) row rather than erroring the whole provider.
 */
const resolvePendingInitialGrant = async (fallback: UserCredits): Promise<UserCredits> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return fallback;

        const response = await fetch('/.netlify/functions/user-credits', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
            },
        });

        if (!response.ok) return fallback;

        const data = await response.json() as UserCreditsApiResponse;
        return {
            remaining: data.creditsRemaining,
            total: data.creditsTotal,
            feedbackCreditsEarned: data.feedbackCreditsEarned,
            referralCreditsEarned: data.referralCreditsEarned,
            resetDate: data.lastResetDate ?? fallback.resetDate,
        };
    } catch (error) {
        console.warn('[CreditsContext] Failed to resolve initial credit grant:', error);
        return fallback;
    }
};

const fetchCreditsForEmail = (email: string, options: { forceRefresh?: boolean } = {}) => {
    const cached = recentCreditsByEmail.get(email);
    if (!options.forceRefresh && cached && Date.now() - cached.fetchedAt < CREDITS_CACHE_TTL_MS) {
        return Promise.resolve(cached.credits);
    }

    const inFlight = inFlightCreditsFetches.get(email);
    if (inFlight) {
        return inFlight;
    }

    const request = Promise.resolve(supabase
        .from('user_credits')
        .select('credits_remaining, credits_total, feedback_credits_earned, referral_credits_earned, last_reset_date, signup_metadata')
        .eq('email', email)
        .single())
        .then(({ data, error: fetchError }) => {
            if (fetchError) {
                if (fetchError.code === 'PGRST116') {
                    return getDefaultCredits();
                }
                throw fetchError;
            }

            if (!data) {
                return getDefaultCredits();
            }

            const row = data as UserCreditsRow;
            const credits = mapCreditsRow(row);

            if (row.signup_metadata?.pending_initial_grant === true) {
                return resolvePendingInitialGrant(credits);
            }

            return credits;
        })
        .then((credits) => {
            recentCreditsByEmail.set(email, { fetchedAt: Date.now(), credits });
            return credits;
        })
        .finally(() => {
            inFlightCreditsFetches.delete(email);
        });

    inFlightCreditsFetches.set(email, request);
    return request;
};

interface CreditsProviderProps {
    children: ReactNode;
}

export function CreditsProvider({ children }: CreditsProviderProps) {
    const { user } = useAuth();
    const userEmail = user?.email ?? null;
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
        if (!userEmail) {
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
            const newCredits = await fetchCreditsForEmail(userEmail, {
                forceRefresh: immediate && hasLoadedOnceRef.current,
            });

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
            setError(null);
        } catch (error: unknown) {
            const fetchError = error as Partial<{ message: string; details: string; hint: string; code: string }>;

            // Enhanced error logging
            console.error('[CreditsContext] Failed to fetch credits:', {
                message: fetchError?.message || 'Unknown error',
                details: fetchError?.details || 'No details available',
                hint: fetchError?.hint || '',
                code: fetchError?.code || '',
            });

            // Only set error state for non-PGRST116 errors
            if (fetchError?.code !== 'PGRST116') {
                // Keep previous credits if available to avoid UI flash
                if (!previousCreditsRef.current) {
                    setError(error instanceof Error ? error : new Error('Failed to fetch credits'));
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
    }, [userEmail]);

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
        if (!userEmail) return;

        const subscription = supabase
            .channel(`user_credits_global:${userEmail}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'user_credits',
                    filter: `email=eq.${userEmail}`,
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
    }, [userEmail, debouncedFetchCredits]);

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
