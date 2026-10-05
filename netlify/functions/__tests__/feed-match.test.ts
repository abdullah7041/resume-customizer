import type { HandlerEvent, HandlerResponse } from '@netlify/functions';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { processMatchOnlyMock, getCachedMock, setCachedMock, getUserMock, fromMock, checkRateLimitMock } = vi.hoisted(() => ({
  processMatchOnlyMock: vi.fn(),
  getCachedMock: vi.fn(),
  setCachedMock: vi.fn(),
  getUserMock: vi.fn(),
  fromMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
}));

vi.mock('../../lib/gemini-client.js', () => ({ processMatchOnly: processMatchOnlyMock }));
vi.mock('../../lib/redis-cache.js', () => ({
  buildCacheKey: vi.fn((_prefix: string, value: unknown) => JSON.stringify(value)),
  getCached: getCachedMock,
  setCached: setCachedMock,
}));
vi.mock('../../lib/rate-limiter.js', () => ({ checkCostBearingRateLimitForIdentifier: checkRateLimitMock }));
vi.mock('../../lib/supabase-client.js', () => ({
  getSupabaseClient: vi.fn(() => ({ auth: { getUser: getUserMock }, from: fromMock })),
}));
vi.mock('../../lib/sentry.js', () => ({
  initSentry: vi.fn(), captureError: vi.fn(), summarizeErrorForLog: vi.fn(String),
}));

const { handler } = await import('../feed-match.js');

function query(result: unknown) {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'is']) chain[method] = vi.fn(() => chain);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  chain.then = (resolve: (value: unknown) => void) => resolve(result);
  return chain;
}

const invoke = async (body: unknown, authenticated = true): Promise<HandlerResponse> => handler({
  httpMethod: 'POST',
  headers: authenticated ? { authorization: 'Bearer token' } : {},
  body: JSON.stringify(body),
} as HandlerEvent, {} as never) as Promise<HandlerResponse>;

beforeEach(() => {
  vi.clearAllMocks();
  getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  checkRateLimitMock.mockResolvedValue({ allowed: true });
  getCachedMock.mockResolvedValue(null);
  processMatchOnlyMock.mockImplementation(async (text: string) => ({
    score: text.includes('service') ? 82 : 64,
    strategicRealityCheck: { riskTier: 'low', recommendation: 'optimize_now', confirmedRisks: [] },
  }));
  fromMock.mockImplementation((table: string) => table === 'user_tracked_companies'
    ? query({ data: [{ company_id: 'company-1' }], error: null })
    : query({ data: { id: 'posting-1', description: 'Customer service and CRM experience required.', description_sha256: 'jd-sha' }, error: null }));
});

describe('feed-match', () => {
  it('returns machine-readable codes for unavailable service and missing posting', async () => {
    fromMock.mockImplementationOnce(() => query({ data: null, error: new Error('offline') }));
    const unavailable = await invoke({ postingId: '11111111-1111-4111-8111-111111111111', resumes: [{ id: 'a', fingerprint: 'a', text: 'resume' }] });
    expect(JSON.parse(unavailable.body ?? '{}').code).toBe('service_unavailable');

    fromMock.mockImplementationOnce(() => query({ data: [], error: null }));
    const missing = await invoke({ postingId: '11111111-1111-4111-8111-111111111111', resumes: [{ id: 'a', fingerprint: 'a', text: 'resume' }] });
    expect(JSON.parse(missing.body ?? '{}').code).toBe('posting_not_found');
  });

  it('returns a code when unexpected provider or database work fails', async () => {
    getUserMock.mockRejectedValueOnce(new Error('unexpected'));
    const response = await invoke({ postingId: '11111111-1111-4111-8111-111111111111', resumes: [{ id: 'a', fingerprint: 'a', text: 'resume' }] });
    expect(JSON.parse(response.body ?? '{}').code).toBe('verification_unavailable');
  });

  it('requires authentication', async () => {
    expect((await invoke({}, false)).statusCode).toBe(401);
  });

  it('matches one bounded resume-job pair against the server-loaded posting without credits', async () => {
    const response = await invoke({
      postingId: '11111111-1111-4111-8111-111111111111',
      language: 'en',
      resumes: [{ id: 'service', fingerprint: 's1', text: 'customer service specialist' }],
    });
    const body = JSON.parse(response.body ?? '{}');
    expect(response.statusCode).toBe(200);
    expect(body.results).toEqual([
      expect.objectContaining({ resumeId: 'service', cached: false, match: expect.objectContaining({ score: 82 }) }),
    ]);
    expect(body.results[0].resumeFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(processMatchOnlyMock).toHaveBeenCalledWith(
      'customer service specialist',
      'Customer service and CRM experience required.',
      'en',
      { featureName: 'feed_match', disableFallback: true, timeoutMs: 30_000 },
    );
    expect(checkRateLimitMock).toHaveBeenCalledTimes(1);
    expect(checkRateLimitMock).toHaveBeenCalledWith('feed-match', 'user-1');
  });

  it('rejects multi-resume requests so one function invocation cannot exceed one AI deadline', async () => {
    const response = await invoke({
      postingId: '11111111-1111-4111-8111-111111111111',
      resumes: [
        { id: 'one', fingerprint: 'same', text: 'first resume' },
        { id: 'two', fingerprint: 'same', text: 'second resume' },
      ],
    });
    expect(response.statusCode).toBe(400);
    expect(processMatchOnlyMock).not.toHaveBeenCalled();
  });

  it('derives cache identity from exact server-bounded text, not a claimed client fingerprint', async () => {
    const base = {
      postingId: '11111111-1111-4111-8111-111111111111',
      resumes: [{ id: 'resume', fingerprint: 'claimed-same', text: 'first resume' }],
    };
    await invoke(base);
    await invoke({ ...base, resumes: [{ ...base.resumes[0], text: 'changed resume' }] });
    expect(setCachedMock).toHaveBeenCalledTimes(2);
    expect(setCachedMock.mock.calls[0][0]).not.toBe(setCachedMock.mock.calls[1][0]);
  });

  it('reuses cached resume-job results without consuming the uncached-pair limit', async () => {
    getCachedMock.mockResolvedValueOnce({ score: 88, strategicRealityCheck: null });
    const response = await invoke({
      postingId: '11111111-1111-4111-8111-111111111111',
      resumes: [{ id: 'cached', fingerprint: 'c1', text: 'cached resume' }],
    });
    const body = JSON.parse(response.body ?? '{}');
    expect(body.results[0]).toMatchObject({ resumeId: 'cached', cached: true, match: { score: 88 } });
    expect(processMatchOnlyMock).not.toHaveBeenCalled();
    expect(checkRateLimitMock).not.toHaveBeenCalled();
  });

  it('fails the paid pair closed when quota infrastructure is unavailable', async () => {
    checkRateLimitMock.mockResolvedValueOnce({ allowed: false, response: { statusCode: 503 } });
    const response = await invoke({
      postingId: '11111111-1111-4111-8111-111111111111',
      resumes: [{ id: 'resume', fingerprint: 'r1', text: 'resume text' }],
    });
    const body = JSON.parse(response.body ?? '{}');
    expect(body.failures[0]).toMatchObject({ resumeId: 'resume', code: 'quota_unavailable' });
    expect(processMatchOnlyMock).not.toHaveBeenCalled();
  });
});
