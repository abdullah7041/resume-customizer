import type { HandlerEvent, HandlerResponse } from '@netlify/functions';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { callOpenRouterMock, captureErrorMock } = vi.hoisted(() => ({
  callOpenRouterMock: vi.fn(),
  captureErrorMock: vi.fn(),
}));

vi.mock('../../lib/rate-limiter.js', () => ({
  withRateLimit: (_name: string, handler: unknown) => handler,
}));

vi.mock('../../lib/openrouter-client.js', () => ({
  callOpenRouter: callOpenRouterMock,
}));

vi.mock('../../lib/sentry.js', () => ({
  initSentry: vi.fn(),
  captureError: captureErrorMock,
  summarizeErrorForLog: vi.fn((error: unknown) => (error instanceof Error ? error.message : String(error))),
}));

const { handler } = await import('../onboard-extract.js');

const invoke = async (body: unknown, httpMethod = 'POST'): Promise<HandlerResponse> => {
  const event = { httpMethod, headers: {}, body: JSON.stringify(body) } as unknown as HandlerEvent;
  return (await handler(event, {} as never)) as HandlerResponse;
};

const parseBody = (response: HandlerResponse) => JSON.parse(response.body ?? '{}');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('onboard-extract handler', () => {
  it('rejects non-POST requests with the current structured envelope', async () => {
    const response = await invoke({ slot: 'role', userText: 'Platform Engineer' }, 'GET');

    expect(response.statusCode).toBe(405);
    expect(parseBody(response)).toEqual({
      status: 405,
      code: 'method_not_allowed',
      message: 'Method Not Allowed',
    });
  });

  it('rejects invalid input before calling OpenRouter', async () => {
    const response = await invoke({ slot: 'unsupported', userText: '' });

    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toMatchObject({ status: 400, code: 'invalid_request' });
    expect(callOpenRouterMock).not.toHaveBeenCalled();
  });

  it('allows guest access and normalizes the cv_basics slot', async () => {
    callOpenRouterMock.mockResolvedValue(JSON.stringify({
      value: {
        name: '  Nora Al-Salem  ',
        label: '',
        achievements: ['Launched a customer portal', '  ', 'Improved onboarding', 'Ignored third item'],
      },
      confidence: 'high',
    }));

    const response = await invoke({ slot: 'cv_basics', userText: 'I am Nora and launched a portal.' });

    expect(response.statusCode).toBe(200);
    expect(parseBody(response)).toEqual({
      value: {
        name: 'Nora Al-Salem',
        achievements: ['Launched a customer portal', 'Improved onboarding'],
      },
      confidence: 'high',
    });
  });

  it('normalizes the role slot and sends the bounded AI call options', async () => {
    callOpenRouterMock.mockResolvedValue(JSON.stringify({
      value: {
        targetRoles: ['Platform Engineer', '', 'Engineering Manager'],
        seniority: 'senior',
      },
      confidence: 'medium',
    }));

    const response = await invoke({
      slot: 'role',
      userText: 'I am targeting senior platform engineering roles.',
      currentIntent: {
        targetRoles: ['Backend Engineer'],
        seniority: 'mid',
        meta: { confidence: 'medium', completeness: 50, updatedAt: '2026-07-21T00:00:00.000Z' },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(parseBody(response)).toEqual({
      value: {
        targetRoles: ['Platform Engineer', 'Engineering Manager'],
        seniority: 'senior',
      },
      confidence: 'medium',
    });
    expect(callOpenRouterMock).toHaveBeenCalledWith(
      'lite',
      expect.arrayContaining([
        expect.objectContaining({ role: 'system' }),
        expect.objectContaining({ role: 'user', content: expect.stringContaining('senior platform engineering roles') }),
      ]),
      expect.objectContaining({ type: 'object' }),
      {
        reasoningBudget: 0,
        maxTokens: 1024,
        timeoutMs: 15000,
        featureName: 'onboard_extract',
        schemaName: 'onboard_slot',
      },
    );
  });

  it('returns the pinned parse-failure envelope for non-JSON AI output', async () => {
    callOpenRouterMock.mockResolvedValue('not-json');

    const response = await invoke({ slot: 'role', userText: 'Platform Engineer' });

    expect(response.statusCode).toBe(502);
    expect(parseBody(response)).toEqual({
      status: 502,
      code: 'onboard/parse_failed',
      message: 'Failed to extract onboarding slot',
      retryable: false,
    });
    expect(captureErrorMock).toHaveBeenCalledTimes(1);
  });

  it('maps AI rejection and timeout to their current envelopes', async () => {
    callOpenRouterMock.mockRejectedValueOnce(new Error('provider failed'));

    const failedResponse = await invoke({ slot: 'role', userText: 'Platform Engineer' });
    expect(failedResponse.statusCode).toBe(500);
    expect(parseBody(failedResponse)).toMatchObject({
      status: 500,
      code: 'onboard/failed',
      retryable: false,
    });

    captureErrorMock.mockClear();
    const timeoutError = Object.assign(new Error('provider timed out'), { name: 'TimeoutError', status: 504 });
    callOpenRouterMock.mockRejectedValueOnce(timeoutError);

    const timeoutResponse = await invoke({ slot: 'role', userText: 'Platform Engineer' });
    expect(timeoutResponse.statusCode).toBe(504);
    expect(parseBody(timeoutResponse)).toMatchObject({
      status: 504,
      code: 'onboard/timeout',
      retryable: true,
    });
    expect(captureErrorMock).not.toHaveBeenCalled();
  });
});
