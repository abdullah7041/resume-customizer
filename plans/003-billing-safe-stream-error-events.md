# Plan 003: Make optimize-stream error events billing-state aware (stop double-charging on post-charge failures)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat baebbd7..HEAD -- netlify/functions/optimize-stream.ts src/services/api.js`
> Plans 001/002 intentionally modify `optimize-stream.ts` (consumption guard,
> cache key). Any OTHER mismatch with the "Current state" excerpts is a STOP
> condition.

## Status

- **Priority**: P1
- **Effort**: S–M
- **Risk**: MED
- **Depends on**: plans/001-enforce-credit-consumption-results.md, plans/002-unify-optimize-cache-and-live-credits.md
- **Category**: bug (billing correctness)
- **Planned at**: commit `baebbd7`, 2026-07-08

## Why this matters

In `optimize-stream.ts`, credits are consumed BEFORE the result is cached and enqueued. If anything throws after consumption (a Redis blip in `setCached`, an enqueue failure), the `catch` emits a generic SSE `error` event. The frontend assumes every server-sent `error` event happened *before* credits were consumed (there is an explicit — and wrong — comment saying so) and marks the failure "billing-state known-safe", which triggers an automatic fallback to the legacy `/optimize` endpoint. That fallback is a second full paid run: the user is charged twice for one optimization, and because the result was never cached, the fallback re-runs Gemini too.

The client already has a safe recovery path for "billing state unknown" failures (a `cacheOnly: true` retry that never charges). This plan makes the server tell the truth about whether credits were consumed, and makes the client route post-charge failures to that safe path.

## Current state

Relevant files:

- `netlify/functions/optimize-stream.ts` — SSE endpoint. Consumption at lines 303–306 (with Plan 001's `success === false` guard immediately after), `setCached` ~line 368, `result`/`done` events after, `catch` block at lines 384–407.
- `src/services/api.js` — `optimizeResumeStream` SSE consumer. Error-event case at lines 844–853; recovery logic at lines 870–900.

Excerpts as of commit `baebbd7`:

`netlify/functions/optimize-stream.ts:384-407` (the catch that lies by omission — every failure, pre- or post-charge, produces the same event):
```ts
} catch (error: any) {
  console.error("[optimize-stream] Error:", summarizeErrorForLog(error));
  ...
  const isTimeout =
    error?.name === "TimeoutError" || error?.status === 504;

  controller.enqueue(
    encoder.encode(
      sseEvent("error", {
        error: isTimeout
          ? "Optimization timed out. Retrying automatically..."
          : "Failed to optimize resume",
        retryable: isTimeout,
      })
    )
  );
} finally {
  controller.close();
}
```

`src/services/api.js:844-853` (client hard-codes the wrong assumption):
```js
case 'error': {
  // Server explicitly signals failure before processing (before credits consumed).
  // Billing state is known-safe — safe to fall back to legacy.
  const error = new Error(parsed.error);
  error.retryable = parsed.retryable;
  error.isBillingStateUnknown = false;
  ...
  throw error;
}
```

`src/services/api.js` recovery semantics (verified by grep):
- line 872: `if (streamErr.isBillingStateUnknown === false)` → rethrow so the caller (`MainContent.tsx` ~line 1227) falls back to the legacy paid endpoint.
- lines 887 and 900: stream-cut / network-failure paths set `isBillingStateUnknown = true` → the safe `cacheOnly` recovery retry runs instead.

So the entire fix is: carry a flag from server to client, default the client to "unknown" instead of "known-safe" unless the server explicitly says pre-charge.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `npm run type:check` | exit 0 |
| Focused tests | `npm run test -- netlify/functions/__tests__/optimize-stream.test.ts src/__tests__/api.optimize-stream.test.js` | all pass |
| Lint | `npm run lint:fix` | exit 0 |

## Scope

**In scope**:
- `netlify/functions/optimize-stream.ts`
- `src/services/api.js` (ONLY the SSE `error`-event case in `optimizeResumeStream`)
- `netlify/functions/__tests__/optimize-stream.test.ts`
- `src/__tests__/api.optimize-stream.test.js`

**Out of scope**:
- `src/components/Layout/MainContent.tsx` — its fallback branch keys off `isBillingStateUnknown`, which this plan sets correctly upstream; do not modify it.
- `netlify/functions/optimize.ts` — the legacy endpoint has no SSE events.
- Retry/timeout semantics (`retryable`, timeout messages) — unchanged.

## Git workflow

- Branch: `advisor/003-billing-safe-stream-errors` (branch from the result of Plan 002).
- Commit style: short imperative subject, matching repo history.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Track consumption in the stream and report it in error events

In `optimize-stream.ts`, inside the `ReadableStream` `start()` body:

1. Declare `let creditsConsumed = false;` near the top of `start()` (alongside other per-run state).
2. Immediately after the `consumeCredits` call succeeds (i.e., after Plan 001's `success === false` guard has NOT returned), set `creditsConsumed = true;` — only on the paid path (`!freePreview && userEmail`).
3. In the `catch` block (lines 384–407 excerpt), extend the error event payload:

```ts
sseEvent("error", {
  error: isTimeout ? "Optimization timed out. Retrying automatically..." : "Failed to optimize resume",
  retryable: isTimeout,
  billingStateUnknown: creditsConsumed,
})
```

Semantics: `billingStateUnknown: true` means "credits may have been (in fact, were) consumed; do not re-run a paid request — use cache-only recovery."

**Verify**: `npm run type:check` → exit 0.

### Step 2: Honor the flag in the client

In `src/services/api.js:844-853`, replace the hard-coded `false` and the stale comment:

```js
case 'error': {
  // Server signals failure. billingStateUnknown=true means credits were
  // (or may have been) consumed before the failure — recovery must use the
  // cache-only path, never a fresh paid fallback.
  const error = new Error(parsed.error);
  error.retryable = parsed.retryable;
  error.isBillingStateUnknown = parsed.billingStateUnknown === true;
  ...
  throw error;
}
```

Keep the rest of the case body (debug attach, `recordFailure`) exactly as-is.

**Verify**: `npm run test -- src/__tests__/api.optimize-stream.test.js` → pass.

## Test plan

1. `netlify/functions/__tests__/optimize-stream.test.ts`: mock `setCached` to reject AFTER `consumeCredits` resolves `{ success: true }` → the emitted SSE `error` event carries `billingStateUnknown: true`.
2. Same file: force a failure BEFORE consumption (e.g., AI client mock rejects) → `error` event carries `billingStateUnknown: false`.
3. `src/__tests__/api.optimize-stream.test.js` (model after existing cases in that file): an SSE `error` event with `billingStateUnknown: true` → the thrown error has `isBillingStateUnknown === true` (so callers take the cache-only path); with the flag absent → `isBillingStateUnknown === false` (legacy fallback preserved for genuinely pre-charge failures).

Verification: focused test command → all pass, including 3+ new tests.

## Done criteria

- [ ] `npm run type:check` exits 0
- [ ] Focused tests pass, including the new tests above
- [ ] `grep -n "billingStateUnknown" netlify/functions/optimize-stream.ts src/services/api.js` → at least one match in each
- [ ] `grep -n "isBillingStateUnknown = false" src/services/api.js` → no hard-coded `false` remains in the SSE error case (line ~850)
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- Plans 001/002 have not landed (no consumption guard / shared key) — execute them first.
- The client recovery branch at `src/services/api.js:872` no longer keys off `isBillingStateUnknown === false` (recovery semantics changed — re-plan).
- The `catch` in `optimize-stream.ts` has been restructured so a single `creditsConsumed` flag can't cover all throw sites between consumption and `done`.
- A step's verification fails twice.

## Maintenance notes

- Anyone adding new post-consumption work in the stream (extra cache writes, telemetry) must keep it inside the region covered by `creditsConsumed = true`.
- Reviewer: confirm the free-preview path never sets `creditsConsumed` (free failures should still fall back to legacy, which is also free for previews).
- Deferred: an explicit `operationId` idempotency key per optimize run (there is a TODO at `optimize-stream.ts:181`) — the durable fix for all double-charge classes; bigger change, not required for this defect.
