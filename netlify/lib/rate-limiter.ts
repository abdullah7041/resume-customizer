/**
 * Rate Limiting and Retry Logic Utilities
 * Handles API request throttling, exponential backoff, and concurrency control
 * 
 * This module provides two types of rate limiting:
 * 1. OUTGOING: Rate limiting for calls to external APIs (Gemini/OpenRouter)
 * 2. INCOMING: Rate limiting for incoming requests to protect endpoints from abuse
 */

import type { Handler, HandlerEvent, HandlerContext, HandlerResponse } from "@netlify/functions";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { summarizeErrorForLog } from "./sentry.js";

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

// ============================================
// INCOMING REQUEST RATE LIMITING
// Protects endpoints from abuse
// ============================================

const RATE_LIMIT_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

/**
 * Rate limit configuration per endpoint
 */
export type EndpointRateLimitConfig = {
  maxRequests: number;  // Max requests per window
  windowMs?: number;    // Window duration in ms (default: 60000 = 1 minute)
};

/**
 * Default rate limits for different endpoint types
 * Stricter limits for "Flash" model endpoints to prevent quota exhaustion and timeouts
 */
export const ENDPOINT_RATE_LIMITS: Record<string, EndpointRateLimitConfig> = {
  // File processing (OCR, parsing) - INCREASED from 10 to 20 for better UX
  "parse-resume": { maxRequests: 20 },
  "extract-resume-json": { maxRequests: 20 },

  // AI endpoints using "Flash" model - INCREASED from 10 to 15
  "ai-match": { maxRequests: 15 },        // Flash model for matching
  "resume-truth-check": { maxRequests: 15 }, // Free authenticated Flash model claim review
  "generate-cover-letter": { maxRequests: 10 },  // Flash model - INCREASED from 5 to 10

  // AI endpoints using "Flash" model - INCREASED from 5 to 10
  "optimize": { maxRequests: 10 },         // Flash model - better UX while preventing abuse
  "optimize-stream": { maxRequests: 10 },  // Flash model via Netlify v2 streaming endpoint
  "vision2030-alignment": { maxRequests: 10 },  // Flash model - deep contextual analysis

  // Generation endpoints using "Lite" model (already fast, keep at 10)
  "predict-questions": { maxRequests: 10 },  // Uses 'lite' model

  // Unauthenticated guest preview parse — stricter than the authenticated limit above
  "extract-resume-json-guest": { maxRequests: 5 },
  // Guest previews are keyed by IP. Saudi mobile carriers CGNAT many users
  // behind one IP, so 1/day blocked everyone after the first visitor per carrier.
  // Worst-case abuse cost at 30 matches/day/IP ≈ $0.27 — cheap vs losing launch traffic.
  // Optimize preview stays tight: the signup wall lives at optimize.
  "ai-match-free-preview": { maxRequests: 30, windowMs: 24 * 60 * 60 * 1000 },
  "optimize-free-preview": { maxRequests: 3, windowMs: 24 * 60 * 60 * 1000 },

  // Unauthenticated waitlist confirmation email — strict to prevent mail-bombing
  "waitlist-confirm": { maxRequests: 5 },

  // Job-URL import: an SSRF-guarded outbound fetch, so keep both tiers tight.
  // Guests are keyed by IP with a daily window (mirrors the free-preview tiers).
  "import-job-url": { maxRequests: 20 },
  "import-job-url-guest": { maxRequests: 10, windowMs: 24 * 60 * 60 * 1000 },

  // Feedback system - INCREASED from 5 to 10

  // Batch processing - INCREASED from 5 to 8
  "batch-api": { maxRequests: 8 },

  // Default for unlisted endpoints
  default: { maxRequests: 30 },
};

// Singleton Upstash Redis client and per-config rate limiters (lazy initialized)
const upstashRatelimitByConfig = new Map<string, Ratelimit>();
let upstashRedis: Redis | null = null;
let upstashInitAttempted = false;
let upstashInitError: string | null = null;

/**
 * Get an Upstash rate limiter for the endpoint config (no in-memory fallback)
 * Returns null if Upstash is not configured
 */
function getRateLimiter(config: EndpointRateLimitConfig): Ratelimit | null {
  initUpstash();

  if (!upstashRedis) {
    return null;
  }

  const windowMs = config.windowMs ?? 60000;
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  const configKey = `${config.maxRequests}:${windowSeconds}`;
  const existingLimiter = upstashRatelimitByConfig.get(configKey);

  if (existingLimiter) {
    return existingLimiter;
  }

  const limiter = new Ratelimit({
    redis: upstashRedis,
    limiter: Ratelimit.slidingWindow(config.maxRequests, `${windowSeconds} s`),
    analytics: true,
    prefix: "resume-optimizer",
    timeout: 3000, // 3s timeout — fail open if Redis is slow/unavailable
  });

  upstashRatelimitByConfig.set(configKey, limiter);
  return limiter;
}

/**
 * Initialize Upstash clients (rate limiter and Redis)
 * Only runs once due to upstashInitAttempted flag
 */
function initUpstash(): void {
  if (upstashInitAttempted) return;

  upstashInitAttempted = true;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    upstashInitError = "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required";
    console.error(`[rate-limiter] ${upstashInitError}`);
    return;
  }

  try {
    // Create a shared Redis client for endpoint-specific rate limiters.
    upstashRedis = new Redis({ url, token });
    console.log("[rate-limiter] ✓ Initialized Upstash Redis client for rate limiting");
  } catch (err) {
    upstashInitError = `Failed to initialize Upstash: ${err instanceof Error ? err.message : String(err)}`;
    console.error(`[rate-limiter] ${upstashInitError}`);
  }
}

/**
 * Extract client identifier from request (IP address)
 */
function getClientIdentifier(event: HandlerEvent): string {
  // Netlify provides client IP in headers
  const ip = event.headers["x-forwarded-for"]?.split(",")[0]?.trim()
    || event.headers["x-real-ip"]
    || event.headers["client-ip"]
    || "unknown";

  return ip;
}

function getClientIdentifierFromHeaders(headers: Headers): string {
  return headers.get("x-nf-client-connection-ip")?.split(",")[0]?.trim()
    || headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || headers.get("x-real-ip")
    || headers.get("client-ip")
    || "unknown";
}

/**
 * Check rate limit for an incoming request
 */
async function checkRateLimit(
  event: HandlerEvent,
  endpoint: string
): Promise<{ allowed: boolean; response?: HandlerResponse }> {
  // DEVELOPMENT MODE: Bypass rate limits for localhost/Netlify dev
  if (process.env.NODE_ENV === 'development' || process.env.NETLIFY_DEV === 'true') {
    console.log('[rate-limiter] Development mode - bypassing rate limits');
    return { allowed: true };
  }

  const clientId = getClientIdentifier(event);
  const config = ENDPOINT_RATE_LIMITS[endpoint] || ENDPOINT_RATE_LIMITS.default;
  const limiter = getRateLimiter(config);

  // If Upstash is not configured, allow requests through (graceful degradation)
  if (!limiter) {
    console.warn(`[rate-limiter] Upstash not configured — allowing request to ${endpoint} (no rate limiting)`);
    return { allowed: true };
  }

  try {
    // Upstash rate limiter - use endpoint-specific identifier
    const identifier = `${endpoint}:${clientId}`;
    const result = await limiter.limit(identifier);

    if (!result.success) {
      console.log(`[rate-limiter] Rate limit exceeded for ${clientId} on ${endpoint}`);
      return {
        allowed: false,
        response: {
          statusCode: 429,
          headers: {
            ...RATE_LIMIT_HEADERS,
            "Retry-After": "60",
            "X-RateLimit-Limit": String(config.maxRequests),
            "X-RateLimit-Remaining": "0",
          },
          body: JSON.stringify({
            error: "Too many requests. Please try again later.",
            retryAfter: 60,
          }),
        },
      };
    }

    return { allowed: true };
  } catch (err) {
    // If rate limiting fails, log error but allow request through
    console.error("[rate-limiter] Rate limit check failed:", summarizeErrorForLog(err));
    return { allowed: true };
  }
}

const PREVIEW_UNAVAILABLE_RESPONSE: HandlerResponse = {
  statusCode: 503,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    error: "Preview is temporarily unavailable. Please sign in to continue, or try again shortly.",
    code: "guest/preview-unavailable",
  }),
};

/**
 * Check rate limit for the unauthenticated guest-preview parse path.
 *
 * Unlike `checkRateLimit`, this fails CLOSED outside development when Upstash
 * isn't configured — anonymous requests must never bypass rate limiting in
 * production, so we'd rather show a calm "preview unavailable" message than
 * allow unlimited unauthenticated calls.
 */
export async function checkGuestPreviewRateLimit(
  event: HandlerEvent
): Promise<{ allowed: boolean; response?: HandlerResponse }> {
  if (process.env.NODE_ENV === 'development' || process.env.NETLIFY_DEV === 'true') {
    return { allowed: true };
  }

  const config = ENDPOINT_RATE_LIMITS["extract-resume-json-guest"];
  const limiter = getRateLimiter(config);

  if (!limiter) {
    console.warn("[rate-limiter] Upstash not configured — failing closed for guest preview");
    return { allowed: false, response: PREVIEW_UNAVAILABLE_RESPONSE };
  }

  try {
    const clientId = getClientIdentifier(event);
    const result = await limiter.limit(`extract-resume-json-guest:${clientId}`);

    if (!result.success) {
      console.log(`[rate-limiter] Guest preview rate limit exceeded for ${clientId}`);
      return {
        allowed: false,
        response: {
          statusCode: 429,
          headers: {
            ...RATE_LIMIT_HEADERS,
            "Retry-After": "60",
            "X-RateLimit-Limit": String(config.maxRequests),
            "X-RateLimit-Remaining": "0",
          },
          body: JSON.stringify({
            error: "Too many preview requests. Please sign in to continue, or try again in a minute.",
            code: "guest/rate-limited",
            retryAfter: 60,
          }),
        },
      };
    }

    return { allowed: true };
  } catch (err) {
    console.error("[rate-limiter] Guest preview rate limit check failed:", summarizeErrorForLog(err));
    return { allowed: false, response: PREVIEW_UNAVAILABLE_RESPONSE };
  }
}

export async function checkFreePreviewRateLimit(
  event: HandlerEvent,
  endpoint: "ai-match-free-preview" | "optimize-free-preview" | "import-job-url-guest",
  userKey?: string | null
): Promise<{ allowed: boolean; response?: HandlerResponse }> {
  if (process.env.NODE_ENV === 'development' || process.env.NETLIFY_DEV === 'true') {
    return { allowed: true };
  }

  const config = ENDPOINT_RATE_LIMITS[endpoint];
  const limiter = getRateLimiter(config);

  if (!limiter) {
    console.warn(`[rate-limiter] Upstash not configured — failing closed for ${endpoint}`);
    return { allowed: false, response: PREVIEW_UNAVAILABLE_RESPONSE };
  }

  try {
    const clientId = userKey || getClientIdentifier(event);
    const result = await limiter.limit(`${endpoint}:${clientId}`);

    if (!result.success) {
      return {
        allowed: false,
        response: {
          statusCode: 429,
          headers: {
            ...RATE_LIMIT_HEADERS,
            "Retry-After": "86400",
            "X-RateLimit-Limit": String(config.maxRequests),
            "X-RateLimit-Remaining": "0",
          },
          body: JSON.stringify({
            error: "You've used your free preview for this feature. Please sign in to continue.",
            code: "guest/free-preview-used",
            retryAfter: 86400,
          }),
        },
      };
    }

    return { allowed: true };
  } catch (err) {
    console.error(`[rate-limiter] ${endpoint} check failed:`, summarizeErrorForLog(err));
    return { allowed: false, response: PREVIEW_UNAVAILABLE_RESPONSE };
  }
}

/**
 * Check rate limit for a Netlify Functions v2 Request/Response handler.
 */
export async function checkRateLimitForRequest(
  request: Request,
  endpoint: string
): Promise<{ allowed: boolean; response?: Response }> {
  if (process.env.NODE_ENV === 'development' || process.env.NETLIFY_DEV === 'true') {
    console.log('[rate-limiter] Development mode - bypassing rate limits');
    return { allowed: true };
  }

  const clientId = getClientIdentifierFromHeaders(request.headers);
  const config = ENDPOINT_RATE_LIMITS[endpoint] || ENDPOINT_RATE_LIMITS.default;
  const limiter = getRateLimiter(config);

  if (!limiter) {
    console.warn(`[rate-limiter] Upstash not configured — allowing request to ${endpoint} (no rate limiting)`);
    return { allowed: true };
  }

  try {
    const identifier = `${endpoint}:${clientId}`;
    const result = await limiter.limit(identifier);

    if (!result.success) {
      console.log(`[rate-limiter] Rate limit exceeded for ${clientId} on ${endpoint}`);
      return {
        allowed: false,
        response: new Response(
          JSON.stringify({
            error: "Too many requests. Please try again later.",
            retryAfter: 60,
          }),
          {
            status: 429,
            headers: {
              ...RATE_LIMIT_HEADERS,
              "Retry-After": "60",
              "X-RateLimit-Limit": String(config.maxRequests),
              "X-RateLimit-Remaining": "0",
            },
          }
        ),
      };
    }

    return { allowed: true };
  } catch (err) {
    console.error("[rate-limiter] Rate limit check failed:", summarizeErrorForLog(err));
    return { allowed: true };
  }
}

export async function checkFreePreviewRateLimitForRequest(
  request: Request,
  endpoint: "optimize-free-preview",
  userKey?: string | null
): Promise<{ allowed: boolean; response?: Response }> {
  if (process.env.NODE_ENV === 'development' || process.env.NETLIFY_DEV === 'true') {
    return { allowed: true };
  }

  const config = ENDPOINT_RATE_LIMITS[endpoint];
  const limiter = getRateLimiter(config);

  if (!limiter) {
    console.warn(`[rate-limiter] Upstash not configured — failing closed for ${endpoint}`);
    return {
      allowed: false,
      response: new Response(PREVIEW_UNAVAILABLE_RESPONSE.body, {
        status: PREVIEW_UNAVAILABLE_RESPONSE.statusCode,
        headers: PREVIEW_UNAVAILABLE_RESPONSE.headers as Record<string, string>,
      }),
    };
  }

  try {
    const clientId = userKey || getClientIdentifierFromHeaders(request.headers);
    const result = await limiter.limit(`${endpoint}:${clientId}`);

    if (!result.success) {
      return {
        allowed: false,
        response: new Response(
          JSON.stringify({
            error: "You've used your free preview for this feature. Please sign in to continue.",
            code: "guest/free-preview-used",
            retryAfter: 86400,
          }),
          {
            status: 429,
            headers: {
              ...RATE_LIMIT_HEADERS,
              "Retry-After": "86400",
              "X-RateLimit-Limit": String(config.maxRequests),
              "X-RateLimit-Remaining": "0",
            },
          }
        ),
      };
    }

    return { allowed: true };
  } catch (err) {
    console.error(`[rate-limiter] ${endpoint} check failed:`, summarizeErrorForLog(err));
    return {
      allowed: false,
      response: new Response(PREVIEW_UNAVAILABLE_RESPONSE.body, {
        status: PREVIEW_UNAVAILABLE_RESPONSE.statusCode,
        headers: PREVIEW_UNAVAILABLE_RESPONSE.headers as Record<string, string>,
      }),
    };
  }
}

/**
 * Wrap a Netlify handler with rate limiting
 * 
 * @example
 * export const handler = withRateLimit("ai-match", async (event) => {
 *   // Your handler logic
 * });
 */
// Track whether startup diagnostics have been logged (once per cold start)
let startupDiagnosticsLogged = false;

export function withRateLimit(
  endpoint: string,
  handler: Handler
): Handler {
  return async (event: HandlerEvent, context: HandlerContext): Promise<HandlerResponse> => {
    // Log startup diagnostics once per cold start (helps diagnose 502s)
    if (!startupDiagnosticsLogged) {
      startupDiagnosticsLogged = true;
      console.log(`[rate-limiter] Startup diagnostics for "${endpoint}":`, {
        UPSTASH_REDIS_REST_URL: !!process.env.UPSTASH_REDIS_REST_URL,
        UPSTASH_REDIS_REST_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN,
        OPENROUTER_API_KEY: !!process.env.OPENROUTER_API_KEY,
        GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
        SUPABASE_URL: !!process.env.SUPABASE_URL,
        NODE_ENV: process.env.NODE_ENV || 'not set',
      });
    }

    // Skip rate limiting for OPTIONS (CORS preflight)
    if (event.httpMethod === "OPTIONS") {
      const result = await handler(event, context);
      return (result as HandlerResponse) ?? { statusCode: 200, body: "" };
    }

    const { allowed, response } = await checkRateLimit(event, endpoint);

    if (!allowed && response) {
      return response;
    }

    const result = await handler(event, context);
    return (result as HandlerResponse) ?? { statusCode: 200, body: "" };
  };
}

/**
 * Get current rate limit status for monitoring
 */
export function getRateLimitStats(): {
  type: "upstash" | "in-memory";
  endpointsConfigured: string[];
} {
  return {
    type: upstashRedis ? "upstash" : "in-memory",
    endpointsConfigured: Object.keys(ENDPOINT_RATE_LIMITS).filter(k => k !== "default"),
  };
}

