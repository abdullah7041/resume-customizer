import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HandlerContext, HandlerEvent, HandlerResponse } from '@netlify/functions';

vi.mock('../../lib/sentry.js', () => ({
  initSentry: vi.fn(),
  captureError: vi.fn(),
  summarizeErrorForLog: vi.fn((error: unknown) => error instanceof Error ? { message: error.message } : { message: String(error) }),
}));

const { handler } = await import('../batch-api.js');

const originalEnv = { ...process.env };

const context = {} as HandlerContext;

function buildEvent(headers: Record<string, string> = {}): HandlerEvent {
  return {
    httpMethod: 'POST',
    headers,
    body: JSON.stringify({ tasks: [] }),
  } as HandlerEvent;
}

describe('batch-api request handling', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  it('does not require a beta code before request validation', async () => {
    const result = await handler(buildEvent(), context, () => undefined) as HandlerResponse;

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body || '{}')).toEqual({
      error: 'tasks array cannot be empty',
    });
  });

  it('ignores stale beta code headers and uses normal request validation', async () => {
    const result = await handler(buildEvent({ 'X-Beta-Code': 'anything-else' }), context, () => undefined) as HandlerResponse;

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body || '{}')).toEqual({
      error: 'tasks array cannot be empty',
    });
  });
});
