# Plan 009: Scrub PII from client-side Sentry error events

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ceed480..HEAD -- src/main.tsx`
> If `src/main.tsx` changed since this plan was written, compare the "Current
> state" excerpt against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (pure redaction; only risk is over-scrubbing useful diagnostics)
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `ceed480`, 2026-07-21

## Why this matters

Watheq is a resume product — its core payload is PII (resume text, names,
emails). The client-side Sentry `beforeSend` hook currently only drops events in
development and otherwise ships them **unmodified**. Session Replay is well
configured (`maskAllText: true`, `blockAllMedia: true`), but ordinary error
events are not scrubbed: if any thrown `Error`, breadcrumb, or request payload
carries resume content, an email, or a name (for example a parse/validation
error that interpolates user content into its message), it is sent to Sentry in
cleartext. The server-side functions already redact via `redactForLog` /
`summarizeErrorForLog`; the browser SDK should mirror that discipline.

After this plan: `beforeSend` sets `sendDefaultPii: false` explicitly and strips
likely-PII (emails and long free-text runs) from error messages, exception
values, and breadcrumb messages before the event leaves the browser.

## Current state

Relevant file:

- `src/main.tsx` — Sentry init at lines 3–34; the `beforeSend` hook is at lines
  29–33.

Excerpt as of commit `ceed480` (`src/main.tsx:3-34`):
```tsx
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
```

Convention pointer: the server-side redaction helpers live in
`netlify/lib/sentry.ts` (`redactForLog`, `summarizeErrorForLog`) — the browser
scrubber should follow the same intent (redact emails and long free-text, keep
short diagnostic tokens). You do not import from `netlify/` into `src/` (separate
build); write a small local scrubber in `src/main.tsx`.

Type note: `@sentry/react`'s `beforeSend` receives an `ErrorEvent` (aliased as
`Sentry.ErrorEvent` / the SDK's event type). Use the SDK's exported types rather
than `any` — the repo rule is "never use `any`". If the precise type is awkward,
import `type { ErrorEvent } from '@sentry/react'` (or the equivalent the
installed version exports) and annotate the helper accordingly.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `npm run type:check` | exit 0, no errors |
| Focused test | `npm run test -- src/__tests__/sentry-scrub` (the new test file) | all pass |
| Lint | `npm run lint:fix` | exit 0 |

## Scope

**In scope** (the only files you should modify/create):
- `src/main.tsx` — the `beforeSend` hook + a small local scrubber helper, and
  `sendDefaultPii: false` in the init options.
- A new test file for the scrubber (see Test plan) — extract the scrubber into a
  tiny exported function so it is unit-testable (see Step 1).

**Out of scope** (do NOT touch):
- The `replayIntegration` config — replay masking is already correct.
- `tracesSampleRate`, `ignoreErrors`, sample-rate options — leave unchanged.
- Server-side `netlify/lib/sentry.ts` — already redacts.
- Do NOT add new Sentry integrations or change the DSN.

## Git workflow

- Branch: `advisor/009-sentry-pii-scrub`
- Single commit; message e.g. `fix: scrub PII from Sentry error events`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Extract a testable scrubber

Create `src/lib/utils/scrubSentryEvent.ts` (matches the repo's `src/lib/utils/`
location for shared helpers — confirm the directory exists with
`ls src/lib/utils/`; if it does not, place the file at `src/lib/scrubSentryEvent.ts`
and import accordingly). Export a pure function:

```ts
import type { ErrorEvent } from '@sentry/react';

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

/** Redact emails and long free-text runs from a string. */
function redactText(input: string): string {
  const noEmails = input.replace(EMAIL_RE, '[redacted-email]');
  // Collapse very long free-text runs (likely pasted resume/JD content) — keep
  // short diagnostic strings intact.
  return noEmails.length > 300 ? `${noEmails.slice(0, 300)}…[redacted-long-text]` : noEmails;
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

  // Drop request bodies/query outright — never needed for client error triage.
  if (event.request) {
    delete event.request.data;
    delete event.request.query_string;
  }

  return event;
}
```

Match the installed `@sentry/react` types — if `ErrorEvent` is not the exact
exported name in this version, use whatever the SDK exports for the `beforeSend`
event parameter (run `npm run type:check` to confirm). Do not fall back to `any`.

**Verify**: `npm run type:check` → exit 0.

### Step 2: Wire it into `beforeSend`

In `src/main.tsx`, add `sendDefaultPii: false,` to the `Sentry.init({...})`
options (near `environment`), and update `beforeSend`:

```tsx
  beforeSend(event) {
    // Don't send errors in development
    if (import.meta.env.DEV) return null;
    return scrubSentryEvent(event);
  },
```

Add the import at the top of `src/main.tsx`:
`import { scrubSentryEvent } from './lib/utils/scrubSentryEvent';` (adjust path if
you placed the file at `src/lib/`).

**Verify**: `npm run type:check` → exit 0; `npm run lint:fix` → exit 0.

### Step 3: Unit-test the scrubber

Create `src/__tests__/sentry-scrub.test.ts` (or co-locate as
`src/lib/utils/__tests__/scrubSentryEvent.test.ts` matching the nearest existing
test convention — check `ls src/__tests__/` and `ls src/lib/utils/__tests__/`
2>/dev/null for the prevailing pattern). Cover:

- An event whose `message` contains an email → output message has
  `[redacted-email]` and no `@`-address.
- An event with `exception.values[0].value` containing a 500-char string → output
  is truncated and ends with `…[redacted-long-text]`.
- A breadcrumb message with an email → redacted.
- An event with `request.data` set → `request.data` is `undefined` after
  scrubbing.
- A short, email-free message (e.g. `"Loading chunk 5 failed"`) → returned
  unchanged (no over-scrubbing).

Model the test structure on any existing Vitest file under `src/__tests__/`.

**Verify**: `npm run test -- sentry-scrub` (or the path you chose) → all pass.

## Test plan

- New unit tests (Step 3): the five cases listed. The "short message unchanged"
  case is the over-scrubbing guard.
- Structural pattern: nearest existing Vitest file (`src/__tests__/*.test.ts`).
- Verification: `npm run test -- sentry-scrub` → all pass, plus
  `npm run type:check` exit 0.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run type:check` exits 0
- [ ] `npm run lint` exits 0 on touched files
- [ ] The new scrubber test file exists and passes (`npm run test -- sentry-scrub`)
- [ ] `grep -n "sendDefaultPii" src/main.tsx` → present and `false`
- [ ] `grep -n "scrubSentryEvent" src/main.tsx` → imported and called in `beforeSend`
- [ ] `grep -rn "any" src/lib/**/scrubSentryEvent.ts` → no `any` type used
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `src/main.tsx`'s Sentry init doesn't match the "Current state" excerpt (drift
  since `ceed480`).
- The installed `@sentry/react` version does not export a usable event type for
  `beforeSend` and the only way to type the helper is `any` — report the version
  and the exported type names rather than using `any` (which the repo forbids).
- `type:check` fails twice after reasonable type adjustments.

## Maintenance notes

- The redaction is intentionally conservative (emails + long-text truncation).
  If future error messages are found still leaking PII (names, phone numbers),
  extend `redactText` — that is why the scrubber is a standalone tested function
  rather than an inline closure.
- Reviewer should confirm the truncation threshold (300 chars) does not clip
  genuinely useful stack/diagnostic strings — stack frames live in
  `exception.values[].stacktrace`, which this scrubber does NOT touch, so normal
  stack traces are preserved.
- Deliberately out of scope: server-side Sentry already redacts; no change there.
