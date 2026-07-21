# Plan 012: Add a top-level rate limit to the batch-api fan-out endpoint

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ceed480..HEAD -- netlify/functions/batch-api.ts netlify/lib/rate-limiter.ts netlify/functions/__tests__/batch-api.test.ts`
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `ceed480`, 2026-07-21

## Why this matters

`batch-api` accepts up to 10 tasks and, for each, calls an internal AI endpoint
(`optimize`, `predict-questions`, `generate-cover-letter`) — a 1-request → up-to-10
downstream-AI-invocation amplifier. Unlike every other AI-facing function in the
repo, it is exported **without** the shared `withRateLimit(...)` wrapper and does
no `auth.getUser` of its own. Its only throttle is an in-process concurrency
`RateLimiter` (which bounds concurrency within a single invocation, not the
number of invocations a caller can make). Child endpoints still enforce their own
per-caller limits and free-preview caps, so the blast radius is bounded — but the
batch layer adds an un-throttled amplification wrapper with no top-level abuse
control. A prior plan removed batch-api's beta gate, so today it has neither a
gate nor a rate limit.

After this plan: `batch-api` is wrapped in `withRateLimit("batch-api", …)` like
every other endpoint, with a dedicated, conservative per-caller limit registered
in `ENDPOINT_RATE_LIMITS`.

Note for the owner (not a blocker for this plan): `grep -rn "batch-api" src/`
returns nothing — the shipped frontend never calls this endpoint; it exists for
beta/API users. If the owner decides to remove the batch surface entirely, this
plan becomes moot. Absent that decision, adding the rate limit is the correct
minimal hardening.

## Current state

Relevant files:

- `netlify/functions/batch-api.ts` — the fan-out function. The handler is
  declared at line 162 and exported bare at the bottom:
  ```ts
  export { handler };
  ```
  It is NOT wrapped in `withRateLimit`. It imports from `../lib/rate-limiter.js`
  only `RateLimiter` and `batchWithConcurrency` (line 2) — not `withRateLimit`.
- `netlify/lib/rate-limiter.ts` — `withRateLimit(endpoint, handler)` is exported
  at line 713; the per-endpoint limits live in `ENDPOINT_RATE_LIMITS` (line 288)
  and unknown endpoints fall back to `ENDPOINT_RATE_LIMITS.default` (line 432),
  so a dedicated entry is optional but preferred here.
- `netlify/functions/__tests__/batch-api.test.ts` — existing tests to keep green.

Excerpt as of commit `ceed480` (`batch-api.ts:1-5`):
```ts
import type { Handler } from "@netlify/functions";
import { RateLimiter, batchWithConcurrency } from "../lib/rate-limiter.js";
import { initSentry, captureError, summarizeErrorForLog } from "../lib/sentry.js";

initSentry();
```

Excerpt (`batch-api.ts:271-273`):
```ts
};

export { handler };
```

Exemplar of the wrapper in use (`generate-pdf.ts:358`):
```ts
export const handler = withRateLimit("generate-pdf", baseHandler);
```

Exemplar `ENDPOINT_RATE_LIMITS` entries (`rate-limiter.ts:299-300`):
```ts
  "optimize": { maxRequests: 10 },         // Flash model - better UX while preventing abuse
  "optimize-stream": { maxRequests: 10 },  // Flash model via Netlify v2 streaming endpoint
```

Convention: functions wrap their base handler and export the wrapped result as
`handler`; the base is conventionally named `baseHandler`. `[ComponentName]` log
prefixes; never log secrets.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `npm run type:check` | exit 0, no errors |
| Focused tests | `npm run test -- netlify/functions/__tests__/batch-api.test.ts` | all pass |
| Lint | `npm run lint:fix` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `netlify/functions/batch-api.ts` — import `withRateLimit`, rename the current
  `handler` const to `baseHandler`, export the wrapped handler.
- `netlify/lib/rate-limiter.ts` — add ONE `"batch-api"` entry to
  `ENDPOINT_RATE_LIMITS`.
- `netlify/functions/__tests__/batch-api.test.ts` — adjust import/invocation if
  the tests call `handler` directly (see STOP conditions).

**Out of scope** (do NOT touch):
- The task validation, `executeTask`, concurrency `RateLimiter`, or the
  child-endpoint fan-out logic — no behavior change beyond the rate-limit wrap.
- Any other `ENDPOINT_RATE_LIMITS` entry.
- Do NOT add an `auth.getUser` requirement in this plan — child endpoints enforce
  their own auth, and requiring auth here is a product decision (beta/API callers
  may be anonymous by design). Rate-limiting is the scope; note the auth question
  in your report.

## Git workflow

- Branch: `advisor/012-batch-api-rate-limit`
- Single commit; message e.g. `fix: rate-limit batch-api fan-out endpoint`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Register a batch-api rate-limit entry

In `netlify/lib/rate-limiter.ts`, add to `ENDPOINT_RATE_LIMITS` (near the other
AI endpoints, after the `optimize`/`optimize-stream` lines):

```ts
  // Fan-out endpoint: 1 request → up to 10 downstream AI calls, so keep tight.
  "batch-api": { maxRequests: 5 },
```

**Verify**: `npm run type:check` → exit 0.

### Step 2: Wrap the batch-api handler

In `netlify/functions/batch-api.ts`:

1. Add `withRateLimit` to the existing rate-limiter import:
   ```ts
   import { RateLimiter, batchWithConcurrency, withRateLimit } from "../lib/rate-limiter.js";
   ```
2. Rename the handler declaration `const handler: Handler = async (event) => {`
   (line 162) to `const baseHandler: Handler = async (event) => {`.
3. Replace the bottom export `export { handler };` with:
   ```ts
   export const handler = withRateLimit("batch-api", baseHandler);
   ```

**Verify**: `npm run type:check` → exit 0; `npm run lint:fix` → exit 0.

### Step 3: Keep tests green (and add one)

Run the existing batch-api tests. If they import `{ handler }` and call it
directly, they still work (the export name is unchanged — it is now the wrapped
handler). If a test asserts behavior that the rate-limiter wrapper changes (e.g.
it does not set the Upstash env vars and the wrapper logs startup diagnostics),
the wrapper **fails open** when Upstash is unconfigured (documented repo
behavior), so tests without Upstash env vars should still pass through to
`baseHandler`. Confirm this; if a test breaks, read why before "fixing" it.

Add one test: a well-formed batch request still returns its normal `200` +
`results` shape after wrapping (proves the wrapper is transparent when the
limiter is not configured / not tripped). Model it on the existing happy-path
test in the file.

**Verify**: `npm run test -- netlify/functions/__tests__/batch-api.test.ts` →
all pass.

## Test plan

- Keep all existing batch-api tests green.
- Add one happy-path test asserting the wrapped `handler` still returns the
  normal batch response (transparency of the wrapper when the limiter is not
  tripped).
- Structural pattern: the existing `batch-api.test.ts`.
- Verification: focused test command above → all pass; `npm run type:check` exit 0.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run type:check` exits 0
- [ ] `npm run lint` exits 0 on both touched files
- [ ] `grep -n "withRateLimit(\"batch-api\"" netlify/functions/batch-api.ts` →
      present
- [ ] `grep -n "\"batch-api\":" netlify/lib/rate-limiter.ts` → present in
      `ENDPOINT_RATE_LIMITS`
- [ ] `grep -n "const baseHandler" netlify/functions/batch-api.ts` → present (old
      bare `handler` renamed)
- [ ] `npm run test -- netlify/functions/__tests__/batch-api.test.ts` passes
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts in "Current state" don't match the live code (drift since
  `ceed480`) — in particular if `batch-api.ts` is already wrapped in
  `withRateLimit` (then this plan is already done — mark it so).
- The existing batch-api tests call the handler in a way that the wrapper breaks
  even with Upstash unconfigured (that would contradict the documented fail-open
  behavior) — report the failure rather than disabling the limiter to pass.
- You conclude the endpoint should require auth as well — do NOT add it here;
  surface it as a follow-up for owner decision.
- A verification fails twice after reasonable fixes.

## Maintenance notes

- `maxRequests: 5` is deliberately tighter than the child endpoints (10) because
  one batch request multiplies into several child calls. Tune if legitimate
  beta/API usage needs more.
- Reviewer should confirm the rename to `baseHandler` did not leave a dangling
  reference to `handler` inside the file (only the final `export const handler`
  should use that name).
- Open question deferred to the owner (recorded, not blocking): whether
  `batch-api` should exist at all (zero frontend callers) or require
  authentication. If it is removed, this plan is superseded.
