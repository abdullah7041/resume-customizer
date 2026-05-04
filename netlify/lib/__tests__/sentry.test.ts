import { describe, expect, it, vi } from 'vitest';

const { captureExceptionMock } = vi.hoisted(() => ({
  captureExceptionMock: vi.fn(),
}));

vi.mock('@sentry/node', () => ({
  captureException: captureExceptionMock,
  init: vi.fn(),
}));

const { captureError, sanitizeSentryContext } = await import('../sentry.js');

describe('sentry context redaction', () => {
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
});
