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
  }

  return { Ratelimit: MockRatelimit };
});

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
