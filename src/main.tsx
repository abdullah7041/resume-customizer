import * as Sentry from "@sentry/react";
import { scrubSentryEvent } from "@/lib/utils/scrubSentryEvent";

const isCheckout = /^\/checkout\/?$/.test(window.location.pathname) || Boolean(sessionStorage.getItem('watheq:checkoutReturn'));
if (!isCheckout) Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: true,  // Privacy: mask PII in session replays
      blockAllMedia: true,
    }),
  ],
  environment: import.meta.env.VITE_DEPLOY_CONTEXT || import.meta.env.MODE,
  initialScope: { tags: { 'watheq.origin': 'browser' } },
  release: import.meta.env.VITE_SENTRY_RELEASE,
  sendDefaultPii: false,

  // Performance Monitoring
  tracesSampleRate: 0.1, // 10% of transactions (adjust for traffic)

  // Session Replay - only on errors
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  // Filter out noise
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Network request failed',
    /Loading chunk \d+ failed/,
    /Timeout waiting for mutex/,  // Ignore Mixpanel mutex errors
  ],

  beforeSend(event) {
    // Don't send errors in development
    if (import.meta.env.DEV) return null;
    return scrubSentryEvent(event);
  },
});

import { StrictMode, type ErrorInfo } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./hooks/useAuth";
import { CreditsProvider } from "./contexts/CreditsContext";
import { analytics } from "./services/analytics";
import "./lib/i18n";
import "./index.css";

// Initialize analytics (respects consent)
if (!isCheckout) void analytics.init();

// React 19 reports render failures through root callbacks. Never attach private error content.
const reportRenderFailure = (_error: unknown, info: ErrorInfo) => {
  Sentry.captureReactException(new Error('Workspace rendering failed'), info, {
    tags: { stage: 'render', code: 'UI_RENDER_FAILED' },
  });
};

createRoot(document.getElementById("root")!, {
  onCaughtError: reportRenderFailure,
  onUncaughtError: reportRenderFailure,
}).render(
  <StrictMode>
    <AuthProvider>
      <CreditsProvider>
        <App />
      </CreditsProvider>
    </AuthProvider>
  </StrictMode>
);




