import { describe, expect, it, vi } from 'vitest';
import { init } from '@sentry/node';

const { captureExceptionMock, flushMock } = vi.hoisted(() => ({
  captureExceptionMock: vi.fn(),
  flushMock: vi.fn(),
}));

vi.mock('@sentry/node', () => ({
  captureException: captureExceptionMock,
  flush: flushMock,
  init: vi.fn(),
}));

const { captureError, initSentry, flushSentry, sanitizeSentryContext, redactForLog, summarizeErrorForLog } = await import('../sentry.js');

describe('sentry context redaction', () => {
  it('groups production failures by stage and cause and drops private SDK request metadata', async () => {
    initSentry();
    const operationId = '31e7fedf-f455-457b-94cf-932f4f38f98c';
    captureError(new Error('PRIVATE provider body'), { function: 'optimize', stage: 'evidence', code: 'OPTIMIZE_NO_VERIFIED_EDITS',
      status: 422, operationId, deployContext: 'production', deployId: 'a'.repeat(24), recovery: 'before-charge' });
    const [error, captured] = captureExceptionMock.mock.lastCall!;
    expect(error.message).toBe('Optimize evidence: OPTIMIZE_NO_VERIFIED_EDITS');
    expect(captured.fingerprint).toEqual(['optimize', 'evidence', 'OPTIMIZE_NO_VERIFIED_EDITS']);
    expect(captured.tags).toMatchObject({ operationId, stage: 'evidence', recovery: 'before-charge' });
    const beforeSend = vi.mocked(init).mock.calls[0][0]!.beforeSend!;
    const event = await beforeSend({ type: undefined, tags: captured.tags, request: { data: 'PRIVATE' },
      breadcrumbs: [{ message: 'PRIVATE' }], user: { email: 'PRIVATE' } }, {});
    expect(event).toMatchObject({ environment: 'production', release: 'a'.repeat(24) });
    expect(JSON.stringify(event)).not.toContain('PRIVATE');
  });
  it('bounds telemetry delivery without changing a worker outcome on transport failure', async () => {
    flushMock.mockRejectedValueOnce(new Error('Telemetry unavailable'));
    await expect(flushSentry()).resolves.toBeUndefined();
    expect(flushMock).toHaveBeenLastCalledWith(1500);
  });
  it('indexes only a validated support operation UUID as a searchable tag', () => {
    const operationId = '31e7fedf-f455-457b-94cf-932f4f38f98c';
    captureError(new Error('Optimization failed'), { operationId });
    expect(captureExceptionMock).toHaveBeenLastCalledWith(expect.any(Error), {
      extra: { operationId }, tags: { operationId },
    });
    captureError(new Error('Optimization failed'), { operationId: 'user@example.com' });
    expect(captureExceptionMock).toHaveBeenLastCalledWith(expect.any(Error), {
      extra: { operationId: '[REDACTED]' },
    });
  });
  it('retains a validated operation UUID without treating numeric segments as a phone', () => {
    const operationId = '12345678-1234-4234-8234-123456789012';
    expect(sanitizeSentryContext({ operationId })).toEqual({ operationId });
    expect(sanitizeSentryContext({ operationId: 'user@example.com' })).toEqual({ operationId: '[REDACTED]' });
  });
  it('redacts resume, job, and identity fields from nested context', () => {
    const sanitized = sanitizeSentryContext({
      function: 'ai-match',
      requestPayload: {
        resumeText: 'Jane Doe\njane@example.com\n+966 55 123 4567\nLong private resume',
        jobText: 'Private job description',
        language: 'en',
      },
      email: 'jane@example.com',
      nested: {
        phone: '+966 55 123 4567',
        safeMessage: 'Failed for jane@example.com',
      },
    }) as Record<string, unknown>;

    const requestPayload = sanitized.requestPayload as Record<string, unknown>;
    const resumeText = requestPayload.resumeText as Record<string, unknown>;
    const jobText = requestPayload.jobText as Record<string, unknown>;
    const nested = sanitized.nested as Record<string, unknown>;

    expect(resumeText.redacted).toBe(true);
    expect(resumeText.length).toBeGreaterThan(0);
    expect(jobText.redacted).toBe(true);
    expect(requestPayload.language).toBe('en');
    expect(sanitized.email).toBe('[REDACTED]');
    expect(nested.phone).toBe('[REDACTED]');
    expect(nested.safeMessage).toBe('Failed for [REDACTED]');
  });

  it('sends sanitized extra context to Sentry', () => {
    const error = new Error('boom');

    captureError(error, {
      requestPayload: {
        resumeText: 'Private resume text',
      },
      userEmail: 'user@example.com',
    });

    expect(captureExceptionMock).toHaveBeenCalledWith(error, {
      extra: {
        requestPayload: {
          resumeText: {
            redacted: true,
            type: 'string',
            length: 19,
            present: true,
          },
        },
        userEmail: '[REDACTED]',
      },
    });
  });

  it('redacts bearer tokens, api keys, addresses, and provider errors', () => {
    const sanitized = sanitizeSentryContext({
      authorization: 'Bearer eyJprivate.header.payload',
      apiKey: 'sk_private_12345678901234567890',
      location: 'Riyadh, Private Street 123',
      message: 'Failed for jane@example.com using Bearer eyJabc.def.ghi',
    }) as Record<string, unknown>;

    expect(sanitized.authorization).toBe('[REDACTED]');
    expect(sanitized.apiKey).toBe('[REDACTED]');
    expect(sanitized.location).toBe('[REDACTED]');
    expect(sanitized.message).toBe('Failed for [REDACTED] using Bearer [REDACTED]');
  });

  it('summarizes errors without stacks or raw secrets', () => {
    const error = new Error('Provider failed for user@example.com with Bearer eyJabc.def.ghi');
    (error as Error & { status?: number; code?: string }).status = 502;
    (error as Error & { status?: number; code?: string }).code = 'BAD_GATEWAY';

    const summary = summarizeErrorForLog(error);

    expect(summary).toEqual({
      name: 'Error',
      message: 'Provider failed for [REDACTED] with Bearer [REDACTED]',
      code: 'BAD_GATEWAY',
      status: 502,
      details: undefined,
      hint: undefined,
    });
    expect(summary).not.toHaveProperty('stack');
  });

  it('redacts log strings directly', () => {
    expect(redactForLog('Call failed with token Bearer eyJabc.def.ghi for user@example.com')).toBe(
      'Call failed with token Bearer [REDACTED] for [REDACTED]'
    );
  });
});
