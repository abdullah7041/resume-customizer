import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockJobs = {
  readOptimizationJob: vi.fn(), claimOptimizationJob: vi.fn(), dispatchOptimizationJob: vi.fn(),
};
vi.mock('../../lib/optimization-jobs.js', async importOriginal => ({
  ...await importOriginal<typeof import('../../lib/optimization-jobs.js')>(), ...mockJobs,
}));

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
  isEmailVerified: vi.fn((user: { email_confirmed_at?: string | null } | null) => Boolean(user?.email_confirmed_at)),
};

const mockVulnerabilityDetector = {
  detectVulnerabilities: vi.fn(() => []),
};

const mockRedisCache = {
  buildCacheKey: vi.fn(() => 'mock-cache-key'),
  buildOptimizeCacheKey: vi.fn(() => 'mock-cache-key'),
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
// Existing stream cases cover transport, cache, and billing; the evidence
// path is covered with the real builder in optimize-evidence-flow.test.ts.
vi.mock('../../lib/optimize-cards.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../lib/optimize-cards.js')>();
  return { ...original, buildEvidenceBackedOptimizationCards: async (value: Parameters<typeof original.buildOptimizationCards>[0], options: { logPrefix: string }) => ({
    cards: original.buildOptimizationCards(value, options), diagnostics: [],
  }) };
});
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
    mockJobs.readOptimizationJob.mockResolvedValue(null);
    mockJobs.claimOptimizationJob.mockResolvedValue(true);
    mockJobs.dispatchOptimizationJob.mockResolvedValue(undefined);
    mockRateLimiter.checkRateLimitForRequest.mockResolvedValue({ allowed: true });
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: '11111111-1111-4111-8111-111111111111',
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
      evidenceVersion: 2,
      evidenceSources: [{ id: 'source', targetId: 'target', kind: 'resume', text: 'Before', fingerprint: 'fingerprint' }],
      cards: [{
        section: 'General',
        issue: 'Cached issue',
        suggestion: 'Cached suggestion',
        exampleBefore: 'Before',
        exampleAfter: 'After',
        evidence: { version: 1, status: 'needs_review', references: [{ sourceId: 'source', quote: 'Before' }] },
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
    // Cache hit returns before pre-charge enforcement but still attaches live balance.
    expect(mockCreditManager.checkCredits).toHaveBeenCalledWith('user@example.com', 'optimize');
    expect(mockCreditManager.consumeCredits).not.toHaveBeenCalled();
  });

  it('does not return a legacy cached card without evidence', async () => {
    mockRedisCache.getCached.mockResolvedValue({ cards: [{ section: 'Experience', exampleAfter: 'Old edit' }] });
    const response = await handler(buildRequest({ Authorization: 'Bearer test-token' }));
    expect(response.headers.get('X-Cache')).not.toBe('HIT');
    expect(response.status).toBe(202);
    expect(mockJobs.dispatchOptimizationJob).toHaveBeenCalledTimes(1);
  });

  it('does not return a cached empty card payload as a successful optimization', async () => {
    mockRedisCache.getCached.mockResolvedValue({
      cards: [],
      keywords: { add: [], neutral: [], remove: [] },
      source: 'gemini',
    });
    const response = await handler(buildRequest({ Authorization: 'Bearer test-token' }));
    expect(response.status).toBe(202);
    expect(response.headers.get('X-Cache')).not.toBe('HIT');
    expect(await response.json()).toEqual({ pending: true });
    expect(mockCreditManager.checkCredits).toHaveBeenCalled();
    expect(mockJobs.dispatchOptimizationJob).toHaveBeenCalledTimes(1);
    expect(mockCreditManager.consumeCredits).not.toHaveBeenCalled();
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

    expect(mockRedisCache.buildOptimizeCacheKey).toHaveBeenCalledWith(
      expect.objectContaining({
        userScope: '11111111-1111-4111-8111-111111111111',
      })
    );
  });

  it('queues exactly one background request without generating or charging in HTTP', async () => {
    mockRedisCache.getCached.mockResolvedValue(null);
    const response = await handler(buildRequest({ Authorization: 'Bearer test-token' }));
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ pending: true });
    expect(mockJobs.dispatchOptimizationJob).toHaveBeenCalledTimes(1);
    expect(mockGeminiClient.optimizeResume).not.toHaveBeenCalled();
    expect(mockCreditManager.consumeCredits).not.toHaveBeenCalled();
  });
  it('polls a running job without generation, credit checks or another handoff', async () => {
    mockRedisCache.getCached.mockResolvedValue(null);
    mockJobs.readOptimizationJob.mockResolvedValue({ state: 'running' });
    const response = await handler(buildRequest({ Authorization: 'Bearer test-token' }, { cacheOnly: true }));
    expect(response.status).toBe(202);
    expect(mockCreditManager.checkCredits).not.toHaveBeenCalled();
    expect(mockJobs.dispatchOptimizationJob).not.toHaveBeenCalled();
    expect(mockJobs.claimOptimizationJob).not.toHaveBeenCalled();
    expect(mockRateLimiter.checkRateLimitForRequest).toHaveBeenCalledWith(expect.any(Request), 'optimize-status');
  });
  it('does not redispatch when an existing worker is running, even with no remaining credits', async () => {
    mockRedisCache.getCached.mockResolvedValue(null);
    mockJobs.readOptimizationJob.mockResolvedValue({ state: 'running' });
    mockJobs.claimOptimizationJob.mockResolvedValue(false);
    mockCreditManager.checkCredits.mockResolvedValue({ hasCredits: false, required: 5, available: 0 });
    const response = await handler(buildRequest({ Authorization: 'Bearer test-token' }));
    expect(response.status).toBe(202);
    expect(mockJobs.dispatchOptimizationJob).not.toHaveBeenCalled();
  });
  it('blocks redispatch after an uncertain billing failure', async () => {
    mockRedisCache.getCached.mockResolvedValue(null);
    mockJobs.readOptimizationJob.mockResolvedValue({ state: 'failed', error: { error: 'Unknown debit', status: 503, billingStateUnknown: true } });
    const response = await handler(buildRequest({ Authorization: 'Bearer test-token' }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ billingStateUnknown: true });
    expect(mockJobs.claimOptimizationJob).not.toHaveBeenCalled();
  });
  it('fails closed when required job storage is unavailable', async () => {
    mockRedisCache.getCached.mockResolvedValue(null);
    mockJobs.readOptimizationJob.mockRejectedValue(new Error('Redis unavailable'));
    const response = await handler(buildRequest({ Authorization: 'Bearer test-token' }));
    expect(response.status).toBe(503);
    expect(mockJobs.dispatchOptimizationJob).not.toHaveBeenCalled();
    expect(mockCreditManager.consumeCredits).not.toHaveBeenCalled();
  });
  it('rejects an oversized UTF-8 envelope before claiming a job', async () => {
    mockRedisCache.getCached.mockResolvedValue(null);
    const response = await handler(buildRequest({ Authorization: 'Bearer test-token' }, {
      resumeText: 'ع'.repeat(49000), jobText: 'ع'.repeat(29000), userClarifications: 'ع'.repeat(49000),
    }));
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ billingStateUnknown: false });
    expect(mockJobs.claimOptimizationJob).not.toHaveBeenCalled();
    expect(mockJobs.dispatchOptimizationJob).not.toHaveBeenCalled();
  });
});
