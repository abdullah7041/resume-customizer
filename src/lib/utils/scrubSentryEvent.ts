import type { ErrorEvent } from '@sentry/react';

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

/** Redact emails and long free-text runs from a string. */
function redactText(input: string): string {
  const shouldTruncate = input.length > 300;
  const noEmails = input.replace(EMAIL_RE, '[redacted-email]');

  return shouldTruncate
    ? `${noEmails.slice(0, 300)}…[redacted-long-text]`
    : noEmails;
}

/** Strip likely-PII from a Sentry error event before it is sent. */
export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  if (event.message) event.message = redactText(event.message);

  for (const value of event.exception?.values ?? []) {
    if (value.value) value.value = redactText(value.value);
  }

  if (Array.isArray(event.breadcrumbs)) {
    for (const crumb of event.breadcrumbs) {
      if (typeof crumb.message === 'string') crumb.message = redactText(crumb.message);
    }
  }

  if (event.request) {
    delete event.request.data;
    delete event.request.query_string;
  }

  return event;
}
