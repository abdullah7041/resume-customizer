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
  getCachedMock.mockResolvedValue(null);
  setCachedMock.mockResolvedValue(undefined);
  getUserMock.mockResolvedValue({ data: { user: { id: 'user-1', email: 'user@example.com' } }, error: null });
});

describe('generate-clarifications handler', () => {
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
      { id: 'one', question: 'What was the migration scope?' },
      { id: 'two', question: 'How many users were affected?' },
      { id: 'three', question: 'What changed after launch?' },
      { id: 'four', question: 'How large was the team?' },
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
