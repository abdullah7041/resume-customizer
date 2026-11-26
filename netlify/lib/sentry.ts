import * as Sentry from "@sentry/node";
import { publicOptimizeCode } from './optimize-error-code.js';

let initialized = false;

const REDACTED = "[REDACTED]";
const CONTENT_FIELD_PATTERN = /(^|_|\b)(resumeText|jobText|jobDescription|plainText|raw_text|rawText|content|data|html|styles|body|value|prompt|response|aiPrompt|aiResponse)($|_|\b)/i;
const IDENTITY_FIELD_PATTERN = /(^|_|\b)(email|userEmail|phone|phoneNumber|address|location|name|fullName|firstName|lastName|token|authorization|password|secret|apiKey|serviceKey|serviceRoleKey|key)($|_|\b)/i;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const KEY_VALUE_PATTERN = /\b(?:sk|pk|or|sb|resend|upstash|service_role|anon)_[A-Za-z0-9._~+/=-]{16,}\b/gi;

export function initSentry() {
    if (initialized) return;

    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.CONTEXT || (process.env.NETLIFY_DEV === 'true' ? 'development' : 'unknown'),
        beforeSend(event) {
            if (event.tags?.workflow !== 'optimize') return event;
            const context = event.tags.netlifyContext;
            if (typeof context === 'string') event.environment = context;
            const deploy = event.tags.netlifyDeploy;
            if (typeof deploy === 'string') event.release = deploy;
            // Automatic HTTP breadcrumbs and request context can contain candidate input.
            delete event.request;
            delete event.breadcrumbs;
            delete event.user;
            delete event.transaction;
            return event;
        },
        release: process.env.COMMIT_REF || process.env.DEPLOY_ID,
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
        .replace(BEARER_PATTERN, `Bearer ${REDACTED}`)
        .replace(JWT_PATTERN, REDACTED)
        .replace(KEY_VALUE_PATTERN, REDACTED)
        .replace(EMAIL_PATTERN, REDACTED)
        .replace(PHONE_PATTERN, REDACTED);
}

export function summarizeErrorForLog(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
        const details = error as Error & {
            code?: unknown;
            status?: unknown;
            statusCode?: unknown;
            details?: unknown;
            hint?: unknown;
        };

        return {
            name: error.name,
            message: redactForLog(error.message),
            code: redactForLog(details.code),
            status: details.status ?? details.statusCode,
            details: sanitizeSentryContext(details.details),
            hint: redactForLog(details.hint),
        };
    }

    if (error && typeof error === "object") {
        return sanitizeSentryContext(error) as Record<string, unknown>;
    }

    return { message: redactForLog(error) };
}

export function summarizePayloadForLog(payload: unknown): unknown {
    return sanitizeSentryContext(payload);
}

export function sanitizeSentryContext(value: unknown, key = "", depth = 0): unknown {
    if (key === 'operationId') {
        return typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value)
            ? value : value == null ? value : REDACTED;
    }
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
    const extra = sanitizeSentryContext(context) as Record<string, unknown> | undefined;
    const operationId = extra?.operationId;
    if (context?.function === 'optimize' || context?.function === 'optimize-background') {
        const stage = typeof context.stage === 'string' && /^(cache|provider|evidence|scoring|billing|delivery|claim|pipeline|persist-result|persist-failure)$/.test(context.stage) ? context.stage : 'pipeline';
        const code = publicOptimizeCode(context.code);
        const tags: Record<string, string> = { workflow: 'optimize', stage, code };
        if (typeof operationId === 'string' && operationId !== REDACTED) tags.operationId = operationId;
        if (typeof context.deployContext === 'string' && ['production', 'deploy-preview', 'branch-deploy', 'dev'].includes(context.deployContext)) tags.netlifyContext = context.deployContext;
        if (typeof context.deployId === 'string' && /^[a-f0-9]{24}$/.test(context.deployId)) tags.netlifyDeploy = context.deployId;
        if (typeof context.recovery === 'string' && ['recovered', 'reconciliation', 'before-charge'].includes(context.recovery)) tags.recovery = context.recovery;
        Sentry.captureException(new Error(`Optimize ${stage}: ${code}`), {
            fingerprint: ['optimize', stage, code], tags,
            extra: { status: context.status, evidenceFailures: extra?.evidenceFailures },
        });
        return;
    }
    Sentry.captureException(error, { extra,
        ...(typeof operationId === 'string' && operationId !== REDACTED ? { tags: { operationId } } : {}),
    });
}

export async function flushSentry(): Promise<void> {
    try { await Sentry.flush(1500); } catch { /* Telemetry must not change the billing outcome. */ }
}
