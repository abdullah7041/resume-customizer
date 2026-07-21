import type { HandlerEvent, HandlerResponse } from '@netlify/functions';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { analyzeResumeTruthCheckMock, captureErrorMock, getUserMock } = vi.hoisted(() => ({
  analyzeResumeTruthCheckMock: vi.fn(),
  captureErrorMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock('../../lib/rate-limiter.js', () => ({
  withRateLimit: (_name: string, handler: unknown) => handler,
}));

vi.mock('../../lib/supabase-client.js', () => ({
  getSupabaseClient: vi.fn(() => ({ auth: { getUser: getUserMock } })),
}));

vi.mock('../../lib/gemini-client.js', () => ({
  analyzeResumeTruthCheck: analyzeResumeTruthCheckMock,
}));

vi.mock('../../lib/model-registry.js', () => ({
  MODELS: { flash: 'test-flash-model' },
}));

vi.mock('../../lib/sentry.js', () => ({
  initSentry: vi.fn(),
  captureError: captureErrorMock,
  summarizeErrorForLog: vi.fn((error: unknown) => (error instanceof Error ? error.message : String(error))),
}));

const { handler } = await import('../resume-truth-check.js');

const validBody = {
  resumeText: 'Led a national transformation program.',
  language: 'en',
  userHardStops: ['Do not claim sole ownership'],
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
  getUserMock.mockResolvedValue({ data: { user: { id: 'user-1', email: 'user@example.com' } }, error: null });
});

describe('resume-truth-check handler', () => {
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

  it('rejects invalid input before calling the AI client', async () => {
    const response = await invoke({ resumeText: '' });

    expect(response.statusCode).toBe(400);
    expect(parseBody(response).error).toEqual(expect.any(String));
    expect(analyzeResumeTruthCheckMock).not.toHaveBeenCalled();
  });

  it('returns the truth-check result with handler debug metadata', async () => {
    analyzeResumeTruthCheckMock.mockResolvedValue({
      overallRisk: 'medium',
      summary: 'One claim needs more evidence.',
      claims: [{ claimText: 'Led a national transformation program.' }],
      debug: { requestId: 'ai-request-1' },
    });

    const response = await invoke(validBody);
    const body = parseBody(response);

    expect(response.statusCode).toBe(200);
    expect(body).toMatchObject({
      overallRisk: 'medium',
      summary: 'One claim needs more evidence.',
      debug: {
        requestId: 'ai-request-1',
        model: 'test-flash-model',
        latencyMs: expect.any(Number),
      },
    });
    expect(analyzeResumeTruthCheckMock).toHaveBeenCalledWith(
      validBody.resumeText,
      'en',
      { userHardStops: validBody.userHardStops },
    );
  });

  it('maps AI failures to the current non-retryable and timeout responses', async () => {
    analyzeResumeTruthCheckMock.mockRejectedValueOnce(new Error('provider failed'));

    const failedResponse = await invoke(validBody);
    expect(failedResponse.statusCode).toBe(500);
    expect(parseBody(failedResponse)).toEqual({
      error: 'Failed to run Resume Truth Check. Please try again.',
      retryable: false,
    });
    expect(captureErrorMock).toHaveBeenCalledTimes(1);

    captureErrorMock.mockClear();
    const timeoutError = Object.assign(new Error('provider timed out'), { name: 'TimeoutError', status: 504 });
    analyzeResumeTruthCheckMock.mockRejectedValueOnce(timeoutError);

    const timeoutResponse = await invoke(validBody);
    expect(timeoutResponse.statusCode).toBe(504);
    expect(timeoutResponse.headers).toMatchObject({
      'Retry-After': '30',
      'X-Timeout-Location': 'openrouter-api',
    });
    expect(parseBody(timeoutResponse).retryable).toBe(true);
    expect(captureErrorMock).not.toHaveBeenCalled();
  });
});
