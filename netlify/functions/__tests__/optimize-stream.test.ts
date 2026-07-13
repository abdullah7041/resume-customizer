import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGeminiClient = {
  optimizeResume: vi.fn(),
};

const mockSentry = {
  initSentry: vi.fn(),
  captureError: vi.fn(),
  summarizeErrorForLog: vi.fn((error: unknown) => error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) }),
};

const mockCreditManager = {
  FEATURE_COSTS: { optimize: 5 },
  checkCredits: vi.fn(),
  consumeCredits: vi.fn(),
  addCredits: vi.fn(),
};

const mockVulnerabilityDetector = {
  detectVulnerabilities: vi.fn(() => []),
};

const mockRedisCache = {
  buildCacheKey: vi.fn(() => 'mock-cache-key'),
  getCached: vi.fn(),
  setCached: vi.fn(),
};

const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
};

const mockSupabaseClient = {
  getSupabaseClient: vi.fn(() => mockSupabase),
};

const mockRateLimiter = {
  checkRateLimitForRequest: vi.fn(),
};

vi.mock('../../lib/gemini-client.js', () => mockGeminiClient);
vi.mock('../../lib/sentry.js', () => mockSentry);
vi.mock('../../lib/credit-manager.js', () => mockCreditManager);
vi.mock('../../lib/vulnerability-detector.js', () => mockVulnerabilityDetector);
vi.mock('../../lib/redis-cache.js', () => mockRedisCache);
vi.mock('../../lib/supabase-client.js', () => mockSupabaseClient);
vi.mock('../../lib/rate-limiter.js', () => mockRateLimiter);

const { default: handler } = await import('../optimize-stream.js');

const buildRequest = (headers: Record<string, string> = {}, body: Record<string, unknown> = {}) =>
  new Request('http://localhost/api/optimize-stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({
      resumeText: 'Resume text with enough detail',
      jobText: 'Job description with enough detail',
      ...body,
    }),
  });

describe('optimize-stream function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimiter.checkRateLimitForRequest.mockResolvedValue({ allowed: true });
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'user@example.com',
          email_confirmed_at: '2026-01-01T00:00:00.000Z',
        },
      },
      error: null,
    });
    mockCreditManager.checkCredits.mockResolvedValue({
      hasCredits: true,
      required: 5,
      available: 10,
    });
    mockRedisCache.getCached.mockResolvedValue({
      cards: [{
        section: 'General',
        issue: 'Cached issue',
        suggestion: 'Cached suggestion',
        exampleBefore: 'Before',
        exampleAfter: 'After',
      }],
      source: 'cache',
    });
  });

  it('checks the v2 rate limit before auth and credits work', async () => {
    const rateLimitedResponse = new Response(
      JSON.stringify({ error: 'Too many requests. Please try again later.', retryAfter: 60 }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '60',
        },
      }
    );
    mockRateLimiter.checkRateLimitForRequest.mockResolvedValue({
      allowed: false,
      response: rateLimitedResponse,
    });

    const response = await handler(buildRequest({ Authorization: 'Bearer test-token' }));
    const body = await response.json() as { error: string };

    expect(response.status).toBe(429);
    expect(body.error).toContain('Too many requests');
    expect(mockRateLimiter.checkRateLimitForRequest).toHaveBeenCalledWith(
      expect.any(Request),
      'optimize-stream'
    );
    expect(mockSupabase.auth.getUser).not.toHaveBeenCalled();
    expect(mockCreditManager.checkCredits).not.toHaveBeenCalled();
  });

  it('continues to auth when the v2 rate limit allows the request', async () => {
    const response = await handler(buildRequest({ Authorization: 'Bearer test-token' }));

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Cache')).toBe('HIT');
    expect(mockRateLimiter.checkRateLimitForRequest).toHaveBeenCalledWith(
      expect.any(Request),
      'optimize-stream'
    );
    expect(mockSupabase.auth.getUser).toHaveBeenCalledWith('test-token');
    // Cache hit returns before credit check — correct behaviour: no double-charge on retries.
    expect(mockCreditManager.checkCredits).not.toHaveBeenCalled();
  });

  it('does not return a cached empty card payload as a successful optimization', async () => {
    mockRedisCache.getCached.mockResolvedValue({
      cards: [],
      keywords: { add: [], neutral: [], remove: [] },
      source: 'gemini',
    });
    mockGeminiClient.optimizeResume.mockResolvedValue({
      match_score: 60,
      missing_keywords: ['React'],
      keywords_to_keep: [],
      keywords_to_avoid: [],
    });
    mockCreditManager.consumeCredits.mockResolvedValue({
      success: true,
      creditsRemaining: 5,
    });

    const response = await handler(buildRequest({ Authorization: 'Bearer test-token' }));
    const streamText = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/event-stream');
    expect(response.headers.get('X-Cache')).not.toBe('HIT');
    expect(streamText).toContain('event: result');
    expect(streamText).toContain('React');
    expect(mockCreditManager.checkCredits).toHaveBeenCalled();
    expect(mockGeminiClient.optimizeResume).toHaveBeenCalled();
  });

  it('does not charge or regenerate when cache-only recovery misses', async () => {
    mockRedisCache.getCached.mockResolvedValue(null);

    const response = await handler(buildRequest(
      { Authorization: 'Bearer test-token' },
      { cacheOnly: true },
    ));
    const body = await response.json() as { error: string };

    expect(response.status).toBe(409);
    expect(body.error).toContain('cached optimization result');
    expect(mockCreditManager.checkCredits).not.toHaveBeenCalled();
    expect(mockGeminiClient.optimizeResume).not.toHaveBeenCalled();
    expect(mockCreditManager.consumeCredits).not.toHaveBeenCalled();
    expect(mockRedisCache.setCached).not.toHaveBeenCalled();
  });

  it('scopes no-charge cache hits to the authenticated user', async () => {
    await handler(buildRequest({ Authorization: 'Bearer test-token' }));

    expect(mockRedisCache.buildCacheKey).toHaveBeenCalledWith(
      'optimize',
      expect.objectContaining({
        userId: 'user-123',
      })
    );
  });

  it('stores cache misses with a short optimization TTL', async () => {
    mockRedisCache.getCached.mockResolvedValue(null);
    mockGeminiClient.optimizeResume.mockResolvedValue({
      match_score: 60,
      missing_keywords: ['React'],
      keywords_to_keep: [],
      keywords_to_avoid: [],
    });
    mockCreditManager.consumeCredits.mockResolvedValue({
      success: true,
      creditsRemaining: 5,
    });

    const response = await handler(buildRequest({ Authorization: 'Bearer test-token' }));
    const streamText = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/event-stream');
    expect(streamText).toContain('event: result');
    expect(mockRedisCache.setCached).toHaveBeenCalledWith(
      'mock-cache-key',
      expect.objectContaining({
        source: 'gemini',
      }),
      600
    );
  });

  it('restores consumed credits when result delivery fails', async () => {
    mockRedisCache.getCached.mockResolvedValue(null);
    mockGeminiClient.optimizeResume.mockResolvedValue({
      match_score: 60,
      missing_keywords: ['React'],
      keywords_to_keep: [],
      keywords_to_avoid: [],
    });
    mockCreditManager.consumeCredits.mockResolvedValue({
      success: true,
      creditsRemaining: 5,
    });
    mockCreditManager.addCredits.mockResolvedValue({
      success: true,
      creditsRemaining: 10,
    });

    const originalEnqueue = ReadableStreamDefaultController.prototype.enqueue;
    vi.spyOn(ReadableStreamDefaultController.prototype, 'enqueue').mockImplementation(function (chunk) {
      const eventText = chunk instanceof Uint8Array
        ? new TextDecoder().decode(chunk)
        : '';
      if (eventText.includes('event: result')) {
        throw new Error('Result delivery failed');
      }
      return originalEnqueue.call(this, chunk);
    });

    const response = await handler(buildRequest({ Authorization: 'Bearer test-token' }));
    const streamText = await response.text();

    expect(streamText).toContain('event: error');
    expect(mockCreditManager.addCredits).toHaveBeenCalledWith(
      'user@example.com',
      5,
      'refund',
      expect.objectContaining({
        feature: 'optimize',
        reason: 'result_delivery_failed',
      }),
    );
  });

  it('labels AI usage events for the streaming endpoint without passing content in options', async () => {
    mockRedisCache.getCached.mockResolvedValue(null);
    mockGeminiClient.optimizeResume.mockResolvedValue({
      match_score: 60,
      missing_keywords: ['React'],
      keywords_to_keep: [],
      keywords_to_avoid: [],
    });
    mockCreditManager.consumeCredits.mockResolvedValue({
      success: true,
      creditsRemaining: 5,
    });

    const response = await handler(buildRequest({ Authorization: 'Bearer test-token' }));
    await response.text();

    expect(mockGeminiClient.optimizeResume).toHaveBeenCalledWith(
      'Resume text with enough detail',
      'Job description with enough detail',
      'en',
      [],
      undefined,
      undefined,
      { featureName: 'optimize_stream' }
    );
    const options = mockGeminiClient.optimizeResume.mock.calls[0][6];
    expect(options).not.toHaveProperty('resumeText');
    expect(options).not.toHaveProperty('jobText');
    expect(options).not.toHaveProperty('messages');
  });

  it('includes user hard stops in the cache key and optimize contract options', async () => {
    mockRedisCache.getCached.mockResolvedValue(null);
    mockGeminiClient.optimizeResume.mockResolvedValue({
      match_score: 60,
      missing_keywords: [],
      keywords_to_keep: [],
      keywords_to_avoid: [],
    });
    mockCreditManager.consumeCredits.mockResolvedValue({ success: true, creditsRemaining: 5 });

    const response = await handler(buildRequest(
      { Authorization: 'Bearer test-token' },
      { userHardStops: ['Excel'] },
    ));
    await response.text();

    expect(mockRedisCache.buildCacheKey).toHaveBeenCalledWith(
      'optimize',
      expect.objectContaining({ userHardStops: ['Excel'] }),
    );
    expect(mockGeminiClient.optimizeResume).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'en',
      [],
      undefined,
      ['Excel'],
      { featureName: 'optimize_stream' },
    );
  });

  it('does not cache a fake zero score when the AI omits score data', async () => {
    mockRedisCache.getCached.mockResolvedValue(null);
    mockGeminiClient.optimizeResume.mockResolvedValue({
      missing_keywords: ['React'],
      keywords_to_keep: [],
      keywords_to_avoid: [],
    });
    mockCreditManager.consumeCredits.mockResolvedValue({
      success: true,
      creditsRemaining: 5,
    });

    const response = await handler(buildRequest({ Authorization: 'Bearer test-token' }));
    const streamText = await response.text();

    expect(response.status).toBe(200);
    expect(streamText).toContain('event: error');
    expect(streamText).toContain('Failed to optimize resume');
    expect(mockRedisCache.setCached).not.toHaveBeenCalled();
  });
});
