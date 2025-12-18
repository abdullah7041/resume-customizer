import * as Sentry from "@sentry/node";

let initialized = false;

export function initSentry() {
    if (initialized) return;

    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.CONTEXT || 'development', // Netlify env
        tracesSampleRate: 0.1,
    });

    initialized = true;
}

export function captureError(error: Error | unknown, context?: Record<string, unknown>) {
    Sentry.captureException(error, { extra: context });
}
