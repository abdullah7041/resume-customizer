# Plan 013: Defer mixpanel behind consent; stop leaking internal error details; honor credit results

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ceed480..HEAD -- src/services/analytics.ts src/main.tsx vite.config.js netlify/functions/referral-api.ts netlify/functions/batch-api.ts netlify/functions/vision2030-alignment.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S–M
- **Risk**: LOW
- **Depends on**: plans/010-handler-tests-new-ai-functions.md (only for part C's test update; parts A/B independent)
- **Category**: perf + security
- **Planned at**: commit `ceed480`, 2026-07-21

## Why this matters

Three independent, small, high-confidence fixes bundled for one pass:

**A.** The Mixpanel SDK is downloaded and parsed at first paint for **every** visitor — including those who never consent — because `analytics.ts` imports it statically AND `vite.config.js` groups it into `vendor-ui` alongside `lucide-react`, which loads at boot. `init()` correctly no-ops without consent, but the bytes are already paid. Fixing only one half is a no-op: a dynamic import still ships eagerly while the chunk grouping pins it to `vendor-ui`.

**B.** Several endpoints return raw internals to clients: `referral-api` returns unredacted `error.message` and, via `describeDbError`, Postgres error codes plus a literal migration filename; `batch-api` returns raw exception messages. This is reconnaissance material — clients should get stable generic messages + codes; details belong in server logs only.

**C.** `vision2030-alignment` calls `consumeCredits` but ignores `success === false`, unlike `optimize.ts` which returns 403 on a raced-to-insufficient balance. Align it.

## Current state

- **A.** `src/services/analytics.ts:1` — `import mixpanel from 'mixpanel-browser';` (static). `:40-60` — `init()` early-returns when `!MIXPANEL_TOKEN` or `!consent.analyticsConsent` (from `useConsentStore.getState()`), then calls `mixpanel.init(MIXPANEL_TOKEN, {...})`. `src/main.tsx:41,46` — imports `analytics` and calls `analytics.init()` at boot. `vite.config.js:118-124` (verified):

  ```js
  // ===== UI UTILITIES (lazy loaded) =====
  if (
    id.includes("lucide-react") ||
    id.includes("mixpanel-browser") ||
    id.includes("file-saver")
  ) {
    return "vendor-ui";
  }
  ```

  `lucide-react` is imported eagerly on the boot path (Header/Footer/MainContent), so `vendor-ui` loads at boot and mixpanel rides along.
- **B.** `netlify/functions/referral-api.ts`:
  - `:355-360` (verified) — top-level catch: `body: JSON.stringify({ error: 'Referral operation failed', details: error instanceof Error ? error.message : 'Unknown error' })`.
  - `:92-108` (verified) — `describeDbError` returns to the **client**: for code `42703`, a message naming `supabase/migrations (see 20260713000000_ensure_referral_schema.sql)`; otherwise `` `${prefix} (db code: ${dbError.code || 'unknown'})` ``.
  - `netlify/functions/batch-api.ts:~100-104` and `:~254-258` (verified) — `const message = error instanceof Error ? error.message : ...` returned in the response body.
  - Server-side logging conventions already exist: `summarizeErrorForLog` / `redactForLog` from `netlify/lib/sentry.js`; errors as `{status, code, message}` (CLAUDE.md rule).
- **C.** `netlify/functions/vision2030-alignment.ts:~104-113` (verified) — `const creditResult = await consumeCredits(userEmail, 'vision2030');` then unconditionally 200 with `creditsRemaining: creditResult.creditsRemaining`. The exemplar to mirror, `netlify/functions/optimize.ts:383-395` (verified):

  ```ts
  if (!freePreview && userEmail && creditResult.success === false) {
    console.warn('[optimize] Credit consumption failed post-generation - balance raced to insufficient');
    return {
      statusCode: 403,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Insufficient credits",
        creditsRequired: 5,
        creditsAvailable: creditResult.creditsRemaining ?? 0,
        creditsNeeded: Math.max(0, 5 - (creditResult.creditsRemaining ?? 0))
      })
    };
  }
  ```

  (vision2030 has no `freePreview` path — the guard is just `creditResult.success === false`. Check `FEATURE_COSTS` in `netlify/lib/credit-manager.js` for vision2030's cost to fill `creditsRequired` honestly.)
- Tests: `netlify/functions/__tests__/referral-api.test.ts`, `batch-api.test.ts` exist; `vision2030-alignment.test.ts` exists **only if plan 010 ran** (it pins current ignore-success behavior — update that pin here). Frontend: `src/services/` has analytics usage throughout; `analytics.ts` exposes methods consumed via `analytics.track...` calls.

## Commands you will need

| Purpose   | Command                                                    | Expected on success |
|-----------|------------------------------------------------------------|---------------------|
| Typecheck | `npm run type:check`                                       | exit 0              |
| Focused tests | `npx vitest run netlify/functions/__tests__/referral-api.test.ts netlify/functions/__tests__/batch-api.test.ts` | pass |
| Full tests | `npm run test`                                            | pass                |
| Build (chunk check) | `npm run build:vite`                                | exit 0; see Step A3 |

## Scope

**In scope**:
- `src/services/analytics.ts`, `src/main.tsx` (only if init call needs an async form), `vite.config.js` (remove one line)
- `netlify/functions/referral-api.ts`, `netlify/functions/batch-api.ts`, `netlify/functions/vision2030-alignment.ts`
- Their test files under `netlify/functions/__tests__/`
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- Consent flow (`useConsentStore`, ConsentBanner) — the gate logic is correct; only the loading strategy changes.
- Other `vendor-*` manualChunks branches — the Sentry/vendor-core/framer chunking rules are documented invariants (CLAUDE.md); touch ONLY the `mixpanel-browser` line.
- `refine-bullet`/`resume-truth-check`/`extract-job-metadata`/`generate-clarifications` charging **no** credits — possibly by design (refine-bullet's header comment says the lightweight loop is deliberate). Recorded as a decide-item in `plans/README.md`; do not add charging here.
- dev-* functions' error responses (dev-only surface).

## Git workflow

- Branch: `advisor/013-analytics-error-hygiene`
- Suggested commit: `fix: defer mixpanel behind consent; generic client error envelopes; vision2030 honors credit result`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step A1: Dynamic-import mixpanel

In `src/services/analytics.ts`: remove the top-level `import mixpanel from 'mixpanel-browser'`; hold a module-level `let mixpanel: typeof import('mixpanel-browser').default | null = null;`. In `init()`, after the existing token+consent early-returns, `mixpanel = (await import('mixpanel-browser')).default;` then proceed with `mixpanel.init(...)` — making `init()` async. Guard every other method that touches `mixpanel` with the existing `this.initialized` flag (they already are — verify by reading the class; any direct `mixpanel.` reference outside `init` must go through the nullable variable). `main.tsx`'s `analytics.init()` becomes fire-and-forget: `void analytics.init();` — no await at boot.

**Verify**: `npm run type:check` → exit 0; `npm run test` (analytics-related suites) → pass.

### Step A2: Un-pin mixpanel from vendor-ui

In `vite.config.js:118-124`, delete the `id.includes("mixpanel-browser") ||` line. Do not touch the other branches.

**Verify**: `git diff vite.config.js` shows exactly one deleted line.

### Step A3: Prove the deferral

`npm run build:vite`, then inspect `dist/assets/`: `grep -l "mixpanel" dist/assets/*.js` — mixpanel code must appear in its own async chunk, and that chunk must NOT be referenced by a `<link rel="modulepreload">`/script tag in `dist/index.html` (`grep mixpanel dist/index.html` → no match, or the chunk filename absent from index.html).

**Verify**: as above. (This is the whole point — if mixpanel still lands in an eagerly-loaded chunk, STOP and report the import chain: `npx vite-bundle-visualizer` or `npm run build:analyze` can show it.)

### Step B1: Generic client envelopes in referral-api

- Top-level catch (`:355-360`): keep the 500 and `error: 'Referral operation failed'`; replace `details: error.message` with a stable `code: 'referral/unexpected'`; move the message into `console.error('[referral-api] ...', summarizeErrorForLog(error))` (a log line already exists — just stop echoing to the client).
- `describeDbError` (`:92-108`): keep the migration-filename diagnosis but **log it** (`console.error`) instead of returning it; the returned `ReferralError` message becomes generic (`'Referral data unavailable'` with code `referral/db-undefined-column` or `referral/db-error`). The error **codes** stay — they're stable identifiers, not internals.

**Verify**: `npx vitest run netlify/functions/__tests__/referral-api.test.ts` → update any assertion pinning the old `details`/message text; all pass.

### Step B2: Generic messages in batch-api

At both catch sites (`:~100-104`, `:~254-258`): replace the raw `error.message` in the response with a generic message (`'Batch item failed'` / `'Batch processing failed'`); keep/extend the existing `summarizeErrorForLog` server logs.

**Verify**: `npx vitest run netlify/functions/__tests__/batch-api.test.ts` → pass (update pins as needed).

### Step C1: vision2030 honors the consume result

After the `consumeCredits` call, add the 403 guard mirroring the optimize exemplar above (no `freePreview` clause; `creditsRequired` from vision2030's `FEATURE_COSTS` entry). Log prefix `[vision2030-alignment]`.

**Verify**: if `vision2030-alignment.test.ts` exists (plan 010), update its pinned case to expect 403 on `{success:false}`; run it → pass. Otherwise `npm run type:check` → exit 0.

### Step D: Full gate

**Verify**: `npm run lint` → 0; `npm run type:check` → 0; `npm run test` → all pass.

## Test plan

- referral-api: assertions that responses carry generic message + code, and that `details` no longer contains exception text.
- batch-api: same for both catch sites.
- vision2030: 403 with `Insufficient credits` envelope when consume fails (new/updated pin).
- Analytics: existing suites; the A3 build inspection is the deferral proof (no unit test for chunking).

## Done criteria

- [ ] `grep -n "^import mixpanel" src/services/analytics.ts` → no match
- [ ] `grep -n "mixpanel-browser" vite.config.js` → no match
- [ ] `grep mixpanel dist/index.html` (after `npm run build:vite`) → no match
- [ ] `grep -n "error.message" netlify/functions/batch-api.ts` → no match inside response bodies (log lines fine)
- [ ] `grep -n "details: error" netlify/functions/referral-api.ts` → no match
- [ ] `grep -n "success === false" netlify/functions/vision2030-alignment.ts` → one match
- [ ] `npm run lint`, `npm run type:check`, `npm run test` all exit 0
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- After A1+A2, mixpanel still ships eagerly (A3 fails) — report the import chain; there may be another static importer (`grep -rn "mixpanel" src/` first).
- Any consumer `await`s `analytics.init()` or calls a track method synchronously at module top-level in a way the async init breaks.
- `describeDbError`'s callers rely on the message text programmatically (grep its call sites) — codes must carry the semantics before message text changes.
- vision2030's `consumeCredits` result shape differs from `{success, creditsRemaining}` (check `credit-manager.js` return).

## Maintenance notes

- New endpoints must never return `error.message` to clients — reviewers should grep for it in PRs; the `{status, code, message}` + `summarizeErrorForLog` pattern is the norm.
- The three uncharged AI endpoints (refine-bullet, resume-truth-check, extract-job-metadata, generate-clarifications) remain a pricing decision for the maintainer — listed in `plans/README.md` candidates.
- If a future consent-revocation flow is added, `analytics.ts` will need an unload/opt-out call — the dynamic-import structure makes that isolated.
