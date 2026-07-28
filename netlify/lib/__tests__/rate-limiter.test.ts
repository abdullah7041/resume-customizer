import type { HandlerEvent, HandlerContext, HandlerResponse } from '@netlify/functions';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
