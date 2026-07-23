import type { HandlerEvent, HandlerResponse } from '@netlify/functions';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  buildCacheKeyMock,
  executeAiContractMock,
  getCachedMock,
  getUserMock,
  setCachedMock,
} = vi.hoisted(() => ({
  buildCacheKeyMock: vi.fn(() => 'clarification-cache-key'),
  executeAiContractMock: vi.fn(),
  getCachedMock: vi.fn(),
  getUserMock: vi.fn(),
  setCachedMock: vi.fn(),
}));

vi.mock('../../lib/rate-limiter.js', () => ({
  withRateLimit: (_name: string, handler: unknown) => handler,
}));

vi.mock('../../lib/supabase-client.js', () => ({
  getSupabaseClient: vi.fn(() => ({ auth: { getUser: getUserMock } })),
}));

vi.mock('../../lib/ai-contracts/executor.js', () => ({
  executeAiContract: executeAiContractMock,
}));

vi.mock('../../lib/redis-cache.js', () => ({
  buildCacheKey: buildCacheKeyMock,
  getCached: getCachedMock,
  setCached: setCachedMock,
}));

vi.mock('../../lib/ip-utils.js', () => ({
  getClientIP: vi.fn(() => '203.0.113.5'),
}));

vi.mock('../../lib/sentry.js', () => ({
  initSentry: vi.fn(),
  captureError: vi.fn(),
  redactForLog: vi.fn(() => '[redacted]'),
  summarizeErrorForLog: vi.fn((error: unknown) => (error instanceof Error ? error.message : String(error))),
}));

const { handler } = await import('../generate-clarifications.js');

const validBody = {
  resumeText: 'Led a platform migration for a regional business.',
  jobText: 'Seeking a platform lead with measurable delivery outcomes.',
  language: 'en',
};

const invoke = async (
  body: unknown,
  headers: Record<string, string> = { authorization: 'Bearer token' },
  httpMethod = 'POST',
): Promise<HandlerResponse> => {
  const event = { httpMethod, headers, body: JSON.stringify(body) } as unknown as HandlerEvent;
  return (await handler(event, {} as never)) as HandlerResponse;
};

const parseBody = (response: HandlerResponse) => JSON.parse(response.body ?? '{}');

beforeEach(() => {
  vi.clearAllMocks();
  setCachedMock.mockResolvedValue(undefined);
  getUserMock.mockResolvedValue({ data: { user: { id: 'user-1', email: 'user@example.com' } }, error: null });
});

describe('generate-clarifications handler', () => {
  describe('auth, validation, and AI contract', () => {
    beforeEach(() => {
      getCachedMock.mockResolvedValue(null);
    });

    it('rejects non-POST requests with the current bare-string body', async () => {
      const response = await invoke(validBody, {}, 'GET');

      expect(response.statusCode).toBe(405);
      expect(response.body).toBe('Method Not Allowed');
    });

    it('requires an Authorization header', async () => {
      const response = await invoke(validBody, {});

      expect(response.statusCode).toBe(401);
      expect(parseBody(response)).toEqual({ error: 'Authentication required. Please sign in.' });
      expect(getUserMock).not.toHaveBeenCalled();
    });

    it('rejects an invalid authenticated session', async () => {
      getUserMock.mockResolvedValue({ data: { user: null }, error: { message: 'invalid token' } });

      const response = await invoke(validBody);

      expect(response.statusCode).toBe(401);
      expect(parseBody(response)).toEqual({ error: 'Invalid or expired authentication token' });
    });

    it('rejects invalid input before cache or AI work', async () => {
      const response = await invoke({ resumeText: '', jobText: validBody.jobText });

      expect(response.statusCode).toBe(400);
      expect(parseBody(response).error).toEqual(expect.any(String));
      expect(getCachedMock).not.toHaveBeenCalled();
      expect(executeAiContractMock).not.toHaveBeenCalled();
    });

    it('returns at most three AI clarifications and caches the response', async () => {
      const clarifications = [
        {
          id: 'scope',
          theme: 'Migration scope',
          rationale: 'The resume does not quantify the platform migration.',
          question: 'What was the migration scope?',
          type: 'single',
          options: [
            { value: 'one_product', label: 'One product' },
            { value: 'several_products', label: 'Several products' },
            { value: 'none', label: "I don't have this experience", isHardStop: true },
          ],
          allowOther: true,
        },
        {
          id: 'users',
          theme: 'User impact',
          rationale: 'The scale of the migration is not visible.',
          question: 'How many users were affected?',
          type: 'single',
          options: [
            { value: '1_3', label: '1–3' },
            { value: '4_10', label: '4–10' },
            { value: 'none', label: "I don't have this experience", isHardStop: true },
          ],
          allowOther: true,
        },
        {
          id: 'outcome',
          theme: 'Launch outcome',
          rationale: 'The resume does not state what changed after launch.',
          question: 'What changed after launch?',
          type: 'multi',
          options: [
            { value: 'faster', label: 'Faster delivery' },
            { value: 'adoption', label: 'Higher adoption' },
            { value: 'none', label: "I don't have this experience", isHardStop: true },
          ],
          allowOther: true,
        },
        {
          id: 'team',
          theme: 'Team size',
          rationale: 'The leadership scope is not quantified.',
          question: 'How large was the team?',
          type: 'single',
          options: [
            { value: '1_3', label: '1–3' },
            { value: '4_10', label: '4–10' },
            { value: 'none', label: "I don't have this experience", isHardStop: true },
          ],
          allowOther: true,
        },
      ];
      executeAiContractMock.mockResolvedValue({ clarifications });

      const response = await invoke(validBody);

      expect(response.statusCode).toBe(200);
      expect(response.headers?.['X-Cache']).toBe('MISS');
      expect(parseBody(response)).toEqual({ clarifications: clarifications.slice(0, 3) });
      expect(executeAiContractMock).toHaveBeenCalledWith('clarification_questions', validBody);
      expect(setCachedMock).toHaveBeenCalledWith(
        'clarification-cache-key',
        { clarifications: clarifications.slice(0, 3) },
        600,
      );
    });

    it('keeps AI rejection non-fatal with an empty clarification list', async () => {
      executeAiContractMock.mockRejectedValue(new Error('provider failed'));

      const response = await invoke(validBody);

      expect(response.statusCode).toBe(200);
      expect(parseBody(response)).toEqual({ clarifications: [] });
      expect(setCachedMock).not.toHaveBeenCalled();
    });
  });

  describe('regeneration and caching', () => {
    const cachedResult = { clarifications: [{ id: 'cached-question' }] };
    const freshResult = { clarifications: [{ id: 'fresh-question' }] };

    beforeEach(() => {
      getCachedMock.mockResolvedValue(cachedResult);
      executeAiContractMock.mockResolvedValue(structuredClone(freshResult));
    });

    it('bypasses the cache read and writes the fresh result when regenerating', async () => {
      const response = await invoke({ ...validBody, regenerate: true });

      expect(response.statusCode).toBe(200);
      expect(response.headers).toMatchObject({ 'X-Cache': 'MISS' });
      expect(parseBody(response)).toEqual(freshResult);
      expect(getCachedMock).not.toHaveBeenCalled();
      expect(executeAiContractMock).toHaveBeenCalledOnce();
      expect(setCachedMock).toHaveBeenCalledWith(
        'clarification-cache-key',
        freshResult,
        600,
      );
    });

    it('uses the cached result when regeneration is not requested', async () => {
      const response = await invoke(validBody);

      expect(response.statusCode).toBe(200);
      expect(response.headers).toMatchObject({ 'X-Cache': 'HIT' });
      expect(parseBody(response)).toEqual(cachedResult);
      expect(getCachedMock).toHaveBeenCalledWith('clarification-cache-key');
      expect(executeAiContractMock).not.toHaveBeenCalled();
      expect(setCachedMock).not.toHaveBeenCalled();
    });

    it('uses the cached result when regeneration is explicitly false', async () => {
      const response = await invoke({ ...validBody, regenerate: false });

      expect(response.statusCode).toBe(200);
      expect(response.headers).toMatchObject({ 'X-Cache': 'HIT' });
      expect(parseBody(response)).toEqual(cachedResult);
      expect(getCachedMock).toHaveBeenCalledWith('clarification-cache-key');
      expect(executeAiContractMock).not.toHaveBeenCalled();
      expect(setCachedMock).not.toHaveBeenCalled();
    });

    it('rejects a non-boolean regenerate value', async () => {
      const response = await invoke({ ...validBody, regenerate: 'true' });

      expect(response.statusCode).toBe(400);
      expect(parseBody(response)).toEqual({
        status: 400,
        code: 'invalid_request',
        message: expect.stringContaining('regenerate'),
        error: expect.stringContaining('regenerate'),
      });
      expect(getCachedMock).not.toHaveBeenCalled();
      expect(executeAiContractMock).not.toHaveBeenCalled();
      expect(setCachedMock).not.toHaveBeenCalled();
    });
  });
});
