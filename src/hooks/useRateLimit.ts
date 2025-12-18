import { useState, useCallback } from 'react';
import { isRateLimitError } from '../types';

interface RateLimitState {
    isLimited: boolean;
    retryAfter: number;
}

export function useRateLimit() {
    const [rateLimitState, setRateLimitState] = useState<RateLimitState>({
        isLimited: false,
        retryAfter: 0,
    });

    const handleError = useCallback((error: unknown): boolean => {
        if (isRateLimitError(error)) {
            setRateLimitState({
                isLimited: true,
                retryAfter: error.retryAfter,
            });
            return true; // Error was handled
        }
        return false; // Error was not a rate limit
    }, []);

    const clearRateLimit = useCallback(() => {
        setRateLimitState({ isLimited: false, retryAfter: 0 });
    }, []);

    return {
        isRateLimited: rateLimitState.isLimited,
        retryAfter: rateLimitState.retryAfter,
        handleError,
        clearRateLimit,
    };
}
