/**
 * Rate Limiting and Retry Logic Utilities
 * Handles API request throttling, exponential backoff, and concurrency control
 */

export type RetryOptions = {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableStatusCodes?: Set<number>;
};

export type RateLimitConfig = {
  maxConcurrent?: number;
  minDelayBetweenRequestsMs?: number;
  maxRequestsPerMinute?: number;
};

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableStatusCodes: new Set([429, 500, 502, 503, 504]),
};

const DEFAULT_RATE_LIMIT: Required<RateLimitConfig> = {
  maxConcurrent: 3,
  minDelayBetweenRequestsMs: 500,
  maxRequestsPerMinute: 20,
};

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calculate exponential backoff delay with jitter
 */
const calculateBackoff = (
  attempt: number,
  options: Required<RetryOptions>
): number => {
  const baseDelay = options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt);
  const jitter = Math.random() * 0.3 * baseDelay; // Add up to 30% jitter
  return Math.min(baseDelay + jitter, options.maxDelayMs);
};

/**
 * Check if an error is retryable
 */
const isRetryableError = (error: any, options: Required<RetryOptions>): boolean => {
  // Network errors are retryable
  if (error?.name === "AbortError" || error?.code === "TIMEOUT") {
    return false; // Don't retry timeouts
  }
  
  if (error?.code === "ECONNREFUSED" || error?.code === "ENOTFOUND") {
    return true;
  }

  // Check HTTP status codes
  if (error?.status && options.retryableStatusCodes.has(error.status)) {
    return true;
  }

  // Check for rate limit messages
  if (error?.message && /rate limit|too many requests/i.test(error.message)) {
    return true;
  }

  return false;
};

/**
 * Execute a function with exponential backoff retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if not retryable or on last attempt
      if (attempt === opts.maxRetries || !isRetryableError(error, opts)) {
        throw lastError;
      }

      // Wait before retrying
      const delay = calculateBackoff(attempt, opts);
      console.log(
        `[retry] Attempt ${attempt + 1}/${opts.maxRetries} failed, retrying in ${Math.round(delay)}ms...`
      );
      await sleep(delay);
    }
  }

  throw lastError || new Error("All retry attempts failed");
}

/**
 * Rate limiter class for managing API request throttling
 */
export class RateLimiter {
  private queue: Array<() => void> = [];
  private activeRequests = 0;
  private requestTimestamps: number[] = [];
  private lastRequestTime = 0;
  private config: Required<RateLimitConfig>;

  constructor(config: RateLimitConfig = {}) {
    this.config = { ...DEFAULT_RATE_LIMIT, ...config };
  }

  /**
   * Remove timestamps older than 1 minute
   */
  private cleanOldTimestamps(): void {
    const oneMinuteAgo = Date.now() - 60000;
    this.requestTimestamps = this.requestTimestamps.filter((ts) => ts > oneMinuteAgo);
  }

  /**
   * Check if we can make a request without exceeding rate limits
   */
  private canMakeRequest(): boolean {
    this.cleanOldTimestamps();

    // Check concurrent limit
    if (this.activeRequests >= this.config.maxConcurrent) {
      return false;
    }

    // Check requests per minute limit
    if (this.requestTimestamps.length >= this.config.maxRequestsPerMinute) {
      return false;
    }

    // Check minimum delay between requests
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
    if (timeSinceLastRequest < this.config.minDelayBetweenRequestsMs) {
      return false;
    }

    return true;
  }

  /**
   * Process the next request in queue if possible
   */
  private processQueue(): void {
    if (this.queue.length === 0) return;
    if (!this.canMakeRequest()) return;

    const next = this.queue.shift();
    if (next) {
      next();
    }
  }

  /**
   * Execute a function with rate limiting
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Wait for our turn if queue is not empty or we can't make request
    if (!this.canMakeRequest() || this.queue.length > 0) {
      await new Promise<void>((resolve) => {
        this.queue.push(resolve);
      });
    }

    // Update tracking
    this.activeRequests++;
    this.lastRequestTime = Date.now();
    this.requestTimestamps.push(this.lastRequestTime);

    try {
      const result = await fn();
      return result;
    } finally {
      this.activeRequests--;
      // Process next in queue after a short delay
      setTimeout(() => this.processQueue(), this.config.minDelayBetweenRequestsMs);
    }
  }

  /**
   * Get current rate limiter stats
   */
  getStats(): {
    activeRequests: number;
    queuedRequests: number;
    requestsInLastMinute: number;
  } {
    this.cleanOldTimestamps();
    return {
      activeRequests: this.activeRequests,
      queuedRequests: this.queue.length,
      requestsInLastMinute: this.requestTimestamps.length,
    };
  }
}

/**
 * Batch requests with concurrency control using Promise.allSettled
 */
export async function batchWithConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  options: {
    concurrency?: number;
    rateLimiter?: RateLimiter;
    // eslint-disable-next-line no-unused-vars
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<PromiseSettledResult<R>[]> {
  const { concurrency = 3, rateLimiter, onProgress } = options;
  const results: PromiseSettledResult<R>[] = [];
  let completed = 0;

  // Process items in chunks based on concurrency
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    
    const chunkPromises = chunk.map(async (currentItem) => {
      const executor = async () => {
        try {
          return await fn(currentItem);
        } finally {
          completed++;
          onProgress?.(completed, items.length);
        }
      };

      // Apply rate limiting if provided
      return rateLimiter ? rateLimiter.execute(executor) : executor();
    });

    // Wait for this chunk to complete before moving to next
    const chunkResults = await Promise.allSettled(chunkPromises);
    results.push(...chunkResults);
  }

  return results;
}

/**
 * Wrapper for DeepSeek API calls with built-in rate limiting and retries
 */
export async function callDeepSeekWithRetry<T>(
  fn: () => Promise<T>,
  options: {
    rateLimiter?: RateLimiter;
    retryOptions?: RetryOptions;
  } = {}
): Promise<T> {
  const { rateLimiter, retryOptions } = options;

  const executor = async () => {
    return await withRetry(fn, {
      maxRetries: 2,
      initialDelayMs: 2000,
      maxDelayMs: 8000,
      retryableStatusCodes: new Set([429, 500, 502, 503]),
      ...retryOptions,
    });
  };

  return rateLimiter ? rateLimiter.execute(executor) : executor();
}
