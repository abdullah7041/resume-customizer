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

function buildEvent(
  headers: Record<string, string> = {},
  body: string = JSON.stringify({ tasks: [] }),
): HandlerEvent {
  return {
    httpMethod: 'POST',
    headers,
    body,
  } as HandlerEvent;
}

describe('batch-api request handling', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
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

  it('returns a generic error for a failed batch item without leaking the exception message', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('connect ECONNREFUSED internal.service:8888'));
    const body = JSON.stringify({
      tasks: [{ id: 'task-1', type: 'optimize', payload: { resumeText: 'text' } }],
    });

    const result = await handler(buildEvent({}, body), context, () => undefined) as HandlerResponse;

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body || '{}')).toEqual({
      results: [{
        id: 'task-1',
        type: 'optimize',
        status: 'error',
        error: 'Batch item failed',
      }],
      summary: { total: 1, successful: 0, failed: 1 },
    });
    expect(result.body).not.toContain('ECONNREFUSED');
    expect(result.body).not.toContain('internal.service');
  });

  it('returns a generic fatal error envelope without leaking parser details', async () => {
    const result = await handler(buildEvent({}, '{"tasks":'), context, () => undefined) as HandlerResponse;

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body || '{}')).toEqual({
      error: 'Batch processing failed',
      hint: 'Check that all task payloads are valid for their respective endpoints',
    });
    expect(result.body).not.toContain('Unexpected end of JSON input');
  });
});
