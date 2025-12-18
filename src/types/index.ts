/**
 * Rate Limit Error Types
 * Used for graceful handling of API rate limiting (HTTP 429)
 */

export interface RateLimitError {
    type: 'RATE_LIMITED';
    retryAfter: number; // seconds
    message: string;
}

export function isRateLimitError(error: unknown): error is RateLimitError {
    return (
        typeof error === 'object' &&
        error !== null &&
        'type' in error &&
        (error as RateLimitError).type === 'RATE_LIMITED'
    );
}
