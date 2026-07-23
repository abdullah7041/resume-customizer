import type { ErrorEvent } from '@sentry/react';
import { describe, expect, it } from 'vitest';
import { scrubSentryEvent } from '@/lib/utils/scrubSentryEvent';

describe('scrubSentryEvent', () => {
  it('redacts an email in an event message', () => {
    const event = { type: undefined, message: 'Failed to parse jane.doe@example.com' } satisfies ErrorEvent;

    const result = scrubSentryEvent(event);

    expect(result.message).toBe('Failed to parse [redacted-email]');
    expect(result.message).not.toContain('@');
  });

  it('truncates long exception values', () => {
    const event = {
      type: undefined,
      exception: { values: [{ value: 'a'.repeat(500) }] },
    } satisfies ErrorEvent;

    const result = scrubSentryEvent(event);

    expect(result.exception?.values?.[0]?.value).toHaveLength(321);
    expect(result.exception?.values?.[0]?.value).toMatch(/…\[redacted-long-text\]$/);
  });

  it('redacts an email in a breadcrumb message', () => {
    const event = {
      type: undefined,
      breadcrumbs: [{ message: 'Uploaded resume for jane.doe@example.com' }],
    } satisfies ErrorEvent;

    const result = scrubSentryEvent(event);

    expect(result.breadcrumbs?.[0]?.message).toBe('Uploaded resume for [redacted-email]');
  });

  it('drops request data', () => {
    const event = {
      type: undefined,
      request: { data: { resume: 'private resume text' }, query_string: 'email=jane.doe@example.com' },
    } satisfies ErrorEvent;

    const result = scrubSentryEvent(event);

    expect(result.request?.data).toBeUndefined();
    expect(result.request?.query_string).toBeUndefined();
  });

  it('preserves short diagnostic messages without email addresses', () => {
    const event = { type: undefined, message: 'Loading chunk 5 failed' } satisfies ErrorEvent;

    expect(scrubSentryEvent(event).message).toBe('Loading chunk 5 failed');
  });

  it('does not mark short input as long after email redaction expands it', () => {
    const message = `${'x'.repeat(293)} a@b.co`;
    const event = {
      type: undefined,
      message,
    } satisfies ErrorEvent;

    const result = scrubSentryEvent(event);

    expect(message).toHaveLength(300);
    expect(result.message).toBe(`${'x'.repeat(293)} [redacted-email]`);
    expect(result.message).not.toContain('[redacted-long-text]');
  });

  it('marks long input as long after email redaction shrinks it', () => {
    const email = 'very.long.email.address@example.com';
    const message = `${'x'.repeat(301 - email.length - 1)} ${email}`;
    const event = {
      type: undefined,
      message,
    } satisfies ErrorEvent;

    const result = scrubSentryEvent(event);

    expect(message).toHaveLength(301);
    expect(result.message).toContain('[redacted-email]');
    expect(result.message).toMatch(/…\[redacted-long-text\]$/);
  });
});
