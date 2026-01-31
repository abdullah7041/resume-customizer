/**
 * CreditsContext
 *
 * Provides shared credit state across the entire app.
 * Ensures CreditBalance in Header and modals always show the same values.
 */

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
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

    const fetchCredits = useCallback(async () => {
        if (!user) {
            setCredits(null);
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            const { data, error: fetchError } = await supabase
                .from('user_credits')
                .select('credits_remaining, credits_total, feedback_credits_earned, referral_credits_earned, last_reset_date')
                .eq('user_id', user.id)
                .single();

            if (fetchError) {
                // Handle "No rows found" (PGRST116) by defaulting to 0 credits
                if (fetchError.code === 'PGRST116') {
                    setCredits({
                        remaining: 0,
                        total: 0,
                        feedbackCreditsEarned: 0,
                        referralCreditsEarned: 0,
                        resetDate: new Date().toISOString(),
                    });
                    return;
                }

                console.error('[CreditsContext] Fetch error:', fetchError);
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
            console.error('[CreditsContext] Failed to fetch credits:', err);
            if ((err as any)?.code !== 'PGRST116') {
                setError(err instanceof Error ? err : new Error('Failed to fetch credits'));
            }
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    // Initial fetch
    useEffect(() => {
        fetchCredits();
    }, [fetchCredits]);

    // Real-time subscription
    useEffect(() => {
        if (!user) return;

        const subscription = supabase
            .channel(`user_credits_global:${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'user_credits',
                    filter: `user_id=eq.${user.id}`,
                },
                (payload) => {
                    fetchCredits();
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [user, fetchCredits]);

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
        refetch: fetchCredits,
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
