import type { HandlerEvent, HandlerContext, HandlerResponse } from '@netlify/functions';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type LimiterConfig = {
  limiter: {
    maxRequests: number;
    window: string;
  };
};

const limitCounts = new Map<string, number>();
const constructedLimiters: LimiterConfig[] = [];

vi.mock('@upstash/redis', () => ({
  Redis: class MockRedis {},
}));

vi.mock('@upstash/ratelimit', () => {
  class MockRatelimit {
    static slidingWindow(maxRequests: number, window: string) {
      return { maxRequests, window };
    }

    private config: LimiterConfig;

    constructor(config: LimiterConfig) {
      this.config = config;
      constructedLimiters.push(config);
    }

    async limit(identifier: string) {
      const nextCount = (limitCounts.get(identifier) ?? 0) + 1;
      limitCounts.set(identifier, nextCount);

      return {
        success: nextCount <= this.config.limiter.maxRequests,
      };
    }

    async resetUsedTokens(identifier: string) {
      limitCounts.delete(identifier);
    }
  }

  return { Ratelimit: MockRatelimit };
});

vi.mock('../sentry.js', () => ({
  summarizeErrorForLog: vi.fn((error: unknown) => error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) }),
}));

async function loadRateLimiter() {
  vi.resetModules();
  return import('../rate-limiter.js');
}

function setProductionUpstashEnv() {
  process.env.NODE_ENV = 'production';
  delete process.env.NETLIFY_DEV;
  process.env.UPSTASH_REDIS_REST_URL = 'https://upstash.example';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
}

function buildRequest(ip = '203.0.113.10') {
  return new Request('https://watheq.example/api/optimize-stream', {
    method: 'POST',
    headers: {
      'x-forwarded-for': ip,
    },
  });
}

function buildEvent(ip = '203.0.113.20'): HandlerEvent {
  return {
    httpMethod: 'POST',
    headers: {
      'x-forwarded-for': ip,
    },
  } as unknown as HandlerEvent;
}

const context = {} as HandlerContext;

describe('rate-limiter endpoint configs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limitCounts.clear();
    constructedLimiters.length = 0;
    setProductionUpstashEnv();
  });

  it('allows requests 1-10 for optimize-stream and rejects request 11', async () => {
    const { checkRateLimitForRequest } = await loadRateLimiter();

    for (let i = 1; i <= 10; i += 1) {
      const result = await checkRateLimitForRequest(buildRequest(), 'optimize-stream');
      expect(result.allowed).toBe(true);
    }

    const blocked = await checkRateLimitForRequest(buildRequest(), 'optimize-stream');
    expect(blocked.allowed).toBe(false);
    expect(blocked.response?.status).toBe(429);
    expect(blocked.response?.headers.get('X-RateLimit-Limit')).toBe('10');
    expect(constructedLimiters[0].limiter).toEqual({
      maxRequests: 10,
      window: '60 s',
    });
  });

  it('keeps higher endpoint limits for v1 handlers', async () => {
    const { withRateLimit } = await loadRateLimiter();
    const handler = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
    });
    const wrapped = withRateLimit('ai-match', handler);

    for (let i = 1; i <= 15; i += 1) {
      const response = await wrapped(buildEvent(), context) as HandlerResponse;
      expect(response.statusCode).toBe(200);
    }

    const blocked = await wrapped(buildEvent(), context) as HandlerResponse;
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers?.['X-RateLimit-Limit']).toBe('15');
    expect(handler).toHaveBeenCalledTimes(15);
  });

  it('keeps default limits for unlisted endpoints', async () => {
    const { withRateLimit } = await loadRateLimiter();
    const handler = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
    });
    const wrapped = withRateLimit('unknown-endpoint', handler);

    for (let i = 1; i <= 30; i += 1) {
      const response = await wrapped(buildEvent('203.0.113.30'), context) as HandlerResponse;
      expect(response.statusCode).toBe(200);
    }

    const blocked = await wrapped(buildEvent('203.0.113.30'), context) as HandlerResponse;
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers?.['X-RateLimit-Limit']).toBe('30');
    expect(handler).toHaveBeenCalledTimes(30);
  });
});

describe('checkGuestPreviewRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limitCounts.clear();
    constructedLimiters.length = 0;
  });

  it('allows requests in development regardless of Upstash config', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.NETLIFY_DEV;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const { checkGuestPreviewRateLimit } = await loadRateLimiter();
    const result = await checkGuestPreviewRateLimit(buildEvent());
    expect(result.allowed).toBe(true);
  });

  it('allows requests under the limit in production with Upstash configured', async () => {
    setProductionUpstashEnv();

    const { checkGuestPreviewRateLimit } = await loadRateLimiter();
    for (let i = 1; i <= 5; i += 1) {
      const result = await checkGuestPreviewRateLimit(buildEvent());
      expect(result.allowed).toBe(true);
    }
  });

  it('rejects requests over the limit in production with 429', async () => {
    setProductionUpstashEnv();

    const { checkGuestPreviewRateLimit } = await loadRateLimiter();
    for (let i = 1; i <= 5; i += 1) {
      await checkGuestPreviewRateLimit(buildEvent());
    }

    const blocked = await checkGuestPreviewRateLimit(buildEvent());
    expect(blocked.allowed).toBe(false);
    expect(blocked.response?.statusCode).toBe(429);
  });

  it('fails closed with 503 in production when Upstash is not configured', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.NETLIFY_DEV;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const { checkGuestPreviewRateLimit } = await loadRateLimiter();
    const result = await checkGuestPreviewRateLimit(buildEvent());
    expect(result.allowed).toBe(false);
    expect(result.response?.statusCode).toBe(503);
  });
});

describe('tryConsumeFreeAllowance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limitCounts.clear();
    constructedLimiters.length = 0;
  });

  it('grants the allowance once per key, then denies on the second attempt (one-shot per user+job)', async () => {
    setProductionUpstashEnv();

    const { tryConsumeFreeAllowance } = await loadRateLimiter();
    const key = 'user-1:jd-hash-a';

    expect(await tryConsumeFreeAllowance('applied-verify-free', key)).toBe(true);
    expect(await tryConsumeFreeAllowance('applied-verify-free', key)).toBe(false);
  });

  it('grants independently per key (different job hash for the same user)', async () => {
    setProductionUpstashEnv();

    const { tryConsumeFreeAllowance } = await loadRateLimiter();

    expect(await tryConsumeFreeAllowance('applied-verify-free', 'user-1:jd-hash-a')).toBe(true);
    expect(await tryConsumeFreeAllowance('applied-verify-free', 'user-1:jd-hash-b')).toBe(true);
  });

  it('fails closed (charges normally) when Upstash is not configured', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.NETLIFY_DEV;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const { tryConsumeFreeAllowance } = await loadRateLimiter();
    expect(await tryConsumeFreeAllowance('applied-verify-free', 'user-1:jd-hash-a')).toBe(false);
  });

  it('fails closed in development too when Upstash is not configured — unlike the rate-limit helpers, a bypass here means "free" not "unblocked"', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.NETLIFY_DEV;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const { tryConsumeFreeAllowance } = await loadRateLimiter();
    expect(await tryConsumeFreeAllowance('applied-verify-free', 'user-1:jd-hash-a')).toBe(false);
  });
});

describe('releaseFreeAllowance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limitCounts.clear();
    constructedLimiters.length = 0;
  });

  it('gives back a consumed allowance so the next attempt is granted again', async () => {
    setProductionUpstashEnv();

    const { tryConsumeFreeAllowance, releaseFreeAllowance } = await loadRateLimiter();
    const key = 'user-1:jd-hash-a';

    expect(await tryConsumeFreeAllowance('applied-verify-free', key)).toBe(true);
    expect(await tryConsumeFreeAllowance('applied-verify-free', key)).toBe(false);

    await releaseFreeAllowance('applied-verify-free', key);

    expect(await tryConsumeFreeAllowance('applied-verify-free', key)).toBe(true);
  });
});

/**
 * The outgoing-request limiter, which is a different mechanism from the incoming
 * endpoint limits above: this one queues our own calls to third parties.
 */
describe('RateLimiter queue draining', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs a caller that arrives while the per-minute window is full', async () => {
    // The deadlock: the queue was drained only from the `finally` of a request
    // that was already running. A caller that arrived when nothing was in flight —
    // held back by the per-minute cap, not by concurrency — had nobody to wake it
    // and waited forever. batch-api allows 15 requests a minute, so the sixteenth
    // task hung its whole function until Netlify killed it.
    const { RateLimiter } = await loadRateLimiter();
    const limiter = new RateLimiter({ maxConcurrent: 1, minDelayBetweenRequestsMs: 0, maxRequestsPerMinute: 2 });

    await limiter.execute(async () => 'first');
    await limiter.execute(async () => 'second');

    let ran = false;
    const third = limiter.execute(async () => {
      ran = true;
      return 'third';
    });

    await vi.advanceTimersByTimeAsync(1_000);
    expect(ran).toBe(false); // still inside the window, correctly held

    await vi.advanceTimersByTimeAsync(61_000);
    await expect(third).resolves.toBe('third');
  });

  it('runs a caller held back only by the minimum delay', async () => {
    const { RateLimiter } = await loadRateLimiter();
    const limiter = new RateLimiter({ maxConcurrent: 1, minDelayBetweenRequestsMs: 200, maxRequestsPerMinute: 100 });

    await limiter.execute(async () => 'first');
    const second = limiter.execute(async () => 'second');

    await vi.advanceTimersByTimeAsync(500);
    await expect(second).resolves.toBe('second');
  });

  it('keeps the minimum spacing it exists to enforce', async () => {
    const { RateLimiter } = await loadRateLimiter();
    const limiter = new RateLimiter({ maxConcurrent: 1, minDelayBetweenRequestsMs: 50, maxRequestsPerMinute: 100 });
    const startedAt: number[] = [];

    const tasks = [0, 1, 2].map(() =>
      limiter.execute(async () => {
        startedAt.push(Date.now());
      }),
    );

    await vi.advanceTimersByTimeAsync(1_000);
    await Promise.all(tasks);

    expect(startedAt).toHaveLength(3);
    expect(startedAt[1] - startedAt[0]).toBeGreaterThanOrEqual(50);
    expect(startedAt[2] - startedAt[1]).toBeGreaterThanOrEqual(50);
  });

  it('never runs more at once than it was told to', async () => {
    const { RateLimiter } = await loadRateLimiter();
    const limiter = new RateLimiter({ maxConcurrent: 2, minDelayBetweenRequestsMs: 0, maxRequestsPerMinute: 100 });
    let active = 0;
    let peak = 0;

    const tasks = [0, 1, 2, 3, 4].map(() =>
      limiter.execute(async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 10));
        active -= 1;
      }),
    );

    await vi.advanceTimersByTimeAsync(1_000);
    await Promise.all(tasks);

    expect(peak).toBe(2);
  });

  it('serves callers in the order they arrived', async () => {
    const { RateLimiter } = await loadRateLimiter();
    const limiter = new RateLimiter({ maxConcurrent: 1, minDelayBetweenRequestsMs: 10, maxRequestsPerMinute: 100 });
    const order: string[] = [];

    const tasks = ['a', 'b', 'c'].map((label) =>
      limiter.execute(async () => {
        order.push(label);
      }),
    );

    await vi.advanceTimersByTimeAsync(1_000);
    await Promise.all(tasks);

    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('does not wedge the queue when a task throws', async () => {
    // The slot has to be released on the failure path too, or one rejected email
    // batch stops every batch behind it.
    const { RateLimiter } = await loadRateLimiter();
    const limiter = new RateLimiter({ maxConcurrent: 1, minDelayBetweenRequestsMs: 10, maxRequestsPerMinute: 100 });

    // Settled into a value up front: the rejection lands while the timers are
    // being advanced, before any assertion could attach a handler to it.
    const failing = limiter
      .execute(async () => {
        throw new Error('provider refused');
      })
      .catch((error: Error) => error.message);
    const following = limiter.execute(async () => 'ran anyway');

    await vi.advanceTimersByTimeAsync(1_000);
    await expect(failing).resolves.toBe('provider refused');
    await expect(following).resolves.toBe('ran anyway');
  });
});
