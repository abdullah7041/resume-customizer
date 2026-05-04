import * as Sentry from "@sentry/node";

let initialized = false;

const REDACTED = "[REDACTED]";
const CONTENT_FIELD_PATTERN = /(^|_|\b)(resumeText|jobText|jobDescription|plainText|raw_text|rawText|content|data|html|body|value)($|_|\b)/i;
const IDENTITY_FIELD_PATTERN = /(^|_|\b)(email|userEmail|phone|phoneNumber|name|fullName|firstName|lastName|token|authorization|password|secret|apiKey)($|_|\b)/i;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/g;

export function initSentry() {
    if (initialized) return;

    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.CONTEXT || 'development', // Netlify env
        tracesSampleRate: 0.1,
    });

    initialized = true;
}

function summarizeContent(value: unknown) {
    if (typeof value === "string") {
        return {
            redacted: true,
            type: "string",
            length: value.length,
            present: value.length > 0,
        };
    }

    if (Array.isArray(value)) {
        return {
            redacted: true,
            type: "array",
            length: value.length,
            present: value.length > 0,
        };
    }

    if (value && typeof value === "object") {
        return {
            redacted: true,
            type: "object",
            keys: Object.keys(value as Record<string, unknown>).slice(0, 20),
            present: true,
        };
    }

    return {
        redacted: true,
        type: typeof value,
        present: value !== null && value !== undefined,
    };
}

function sanitizeString(value: string): string {
    return value
        .replace(EMAIL_PATTERN, REDACTED)
        .replace(PHONE_PATTERN, REDACTED);
}

export function sanitizeSentryContext(value: unknown, key = "", depth = 0): unknown {
    if (IDENTITY_FIELD_PATTERN.test(key)) {
        return REDACTED;
    }

    if (CONTENT_FIELD_PATTERN.test(key)) {
        return summarizeContent(value);
    }

    if (typeof value === "string") {
        return sanitizeString(value);
    }

    if (value === null || value === undefined || typeof value !== "object") {
        return value;
    }

    if (depth >= 4) {
        return "[REDACTED_DEPTH_LIMIT]";
    }

    if (Array.isArray(value)) {
        return value.slice(0, 20).map((item) => sanitizeSentryContext(item, key, depth + 1));
    }

    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
            entryKey,
            sanitizeSentryContext(entryValue, entryKey, depth + 1),
        ])
    );
}

export function redactForLog(value: unknown): unknown {
    if (typeof value === "string") {
        return sanitizeString(value);
    }

    return sanitizeSentryContext(value);
}

export function captureError(error: Error | unknown, context?: Record<string, unknown>) {
    Sentry.captureException(error, { extra: sanitizeSentryContext(context) as Record<string, unknown> | undefined });
}
