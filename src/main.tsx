import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: true,  // Privacy: mask PII in session replays
      blockAllMedia: true,
    }),
  ],
  environment: import.meta.env.MODE,

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
    return event;
  },
});

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./hooks/useAuth";
import { CreditsProvider } from "./contexts/CreditsContext";
import { analytics } from "./services/analytics";
import "./lib/i18n";
import "./index.css";

// Initialize analytics (respects consent)
analytics.init();

// Pre-warm the PDF generation serverless function to drastically reduce cold starts
fetch('/.netlify/functions/generate-pdf', { method: 'HEAD' }).catch(() => {});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <CreditsProvider>
        <App />
      </CreditsProvider>
    </AuthProvider>
  </StrictMode>
);




