import type { HandlerEvent, HandlerResponse } from '@netlify/functions';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  executeAiContractMock,
  getCachedMock,
  getUserMock,
  setCachedMock,
} = vi.hoisted(() => ({
  executeAiContractMock: vi.fn(),
  getCachedMock: vi.fn(),
  getUserMock: vi.fn(),
  setCachedMock: vi.fn(),
}));

vi.mock('../../lib/ai-contracts/executor.js', () => ({
  executeAiContract: executeAiContractMock,
}));

vi.mock('../../lib/rate-limiter.js', () => ({
  withRateLimit: (_name: string, handler: unknown) => handler,
}));

vi.mock('../../lib/redis-cache.js', () => ({
  buildCacheKey: vi.fn(() => 'clarification-cache-key'),
  getCached: getCachedMock,
  setCached: setCachedMock,
}));

vi.mock('../../lib/supabase-client.js', () => ({
  getSupabaseClient: vi.fn(() => ({ auth: { getUser: getUserMock } })),
}));

vi.mock('../../lib/sentry.js', () => ({
  initSentry: vi.fn(),
  captureError: vi.fn(),
  redactForLog: vi.fn(() => '[redacted]'),
  summarizeErrorForLog: vi.fn((error: unknown) => (
    error instanceof Error ? error.message : String(error)
  )),
}));

const { handler } = await import('../generate-clarifications.js');

const invoke = async (body: unknown): Promise<HandlerResponse> => {
  const event = {
    httpMethod: 'POST',
    headers: { authorization: 'Bearer test-token' },
    body: JSON.stringify(body),
  } as unknown as HandlerEvent;

  return (await handler(event, {} as never)) as HandlerResponse;
};

const requestBody = {
  resumeText: 'Experienced engineer with measurable delivery results.',
  jobText: 'Seeking an engineer with delivery and leadership experience.',
  language: 'en',
};

const cachedResult = {
  clarifications: [{ id: 'cached-question' }],
};

const freshResult = {
  clarifications: [{ id: 'fresh-question' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  getUserMock.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'user@example.com' } },
    error: null,
  });
  getCachedMock.mockResolvedValue(cachedResult);
  executeAiContractMock.mockResolvedValue(structuredClone(freshResult));
  setCachedMock.mockResolvedValue(undefined);
});

describe('generate-clarifications handler', () => {
  it('bypasses the cache read and writes the fresh result when regenerating', async () => {
    const response = await invoke({ ...requestBody, regenerate: true });

    expect(response.statusCode).toBe(200);
    expect(response.headers).toMatchObject({ 'X-Cache': 'MISS' });
    expect(JSON.parse(response.body ?? '{}')).toEqual(freshResult);
    expect(getCachedMock).not.toHaveBeenCalled();
    expect(executeAiContractMock).toHaveBeenCalledOnce();
    expect(setCachedMock).toHaveBeenCalledWith(
      'clarification-cache-key',
      freshResult,
      600,
    );
  });

  it('uses the cached result when regeneration is not requested', async () => {
    const response = await invoke(requestBody);

    expect(response.statusCode).toBe(200);
    expect(response.headers).toMatchObject({ 'X-Cache': 'HIT' });
    expect(JSON.parse(response.body ?? '{}')).toEqual(cachedResult);
    expect(getCachedMock).toHaveBeenCalledWith('clarification-cache-key');
    expect(executeAiContractMock).not.toHaveBeenCalled();
    expect(setCachedMock).not.toHaveBeenCalled();
  });
});
