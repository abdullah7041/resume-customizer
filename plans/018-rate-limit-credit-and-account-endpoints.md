# Plan 018: Put the three unlimited authenticated endpoints behind the rate limiter

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d2fba38..HEAD -- netlify/functions/feedback-api.ts netlify/functions/referral-api.ts netlify/functions/user-data-api.ts netlify/lib/rate-limiter.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `d2fba38`, 2026-08-08

## Why this matters

Every other Netlify function in this repo passes through the rate limiter —
18 of them via the v1 `withRateLimit(name, baseHandler)` wrapper, and
`optimize-stream.ts` via the v2 equivalent `checkRateLimitForRequest`. Three do
not, and they are three of the most consequential:

- `feedback-api.ts` — **awards credits** (`credits_awarded`, `reward_status`)
- `referral-api.ts` — **awards referral credits**
- `user-data-api.ts` — full data export and **account deletion**
  (`supabase.auth.admin.deleteUser`)

All three verify a Supabase JWT, so this is not an anonymous-abuse hole. It is
an authenticated-abuse and blast-radius hole: one signed-in account can hammer
a credit-awarding endpoint or the account-deletion path as fast as the network
allows, with no throttle and no Upstash-backed counter.

A previous round found exactly this defect on `batch-api` (tracked as SEC-09),
planned it, and fixed it — these three were missed by that sweep. There is also
a stale comment in the rate-limit registry that makes it *look* as though
feedback is already limited, which is likely how it stayed unnoticed.

After this plan: all three endpoints are wrapped, each has a deliberate limit
in `ENDPOINT_RATE_LIMITS`, the misleading comment is gone, and a test pins the
wrapper on each so a future refactor can't quietly unwrap them again.

## Current state

### The three unwrapped handlers

`netlify/functions/feedback-api.ts:374`:

```ts
export const handler: Handler = async (event) => {
```

`netlify/functions/referral-api.ts:276` and `:386`:

```ts
const handler: Handler = async (event) => {
// ... 110 lines ...
export { handler };
```

`netlify/functions/user-data-api.ts:215`:

```ts
export const handler: Handler = async (event) => {
```

None of these files contains the string `withRateLimit`, `checkRateLimitForRequest`,
`rateLimit`, or `ratelimit` anywhere — verified by search across all four
candidate files (the fourth, `notify-waitlist.ts`, is out of scope: it is gated
by `requireAdminMutationGate` and an admin secret, so it is not publicly
reachable).

### The exemplar to copy — `user-credits.ts`

`netlify/functions/user-credits.ts:23` and `:89` show the exact pattern this
repo uses:

```ts
const baseHandler: Handler = async (event) => {
  // ...
};

export const handler = withRateLimit('user-credits', baseHandler);
```

with the import at `netlify/functions/user-credits.ts:4`:

```ts
import { withRateLimit } from '../lib/rate-limiter.js';
```

Note the `.js` extension on the import — this repo's Netlify functions are
ESM-resolved and every sibling import uses it. Match that.

### The rate-limit registry and its stale comment

`netlify/lib/rate-limiter.ts:288-334` defines `ENDPOINT_RATE_LIMITS`. At
`netlify/lib/rate-limiter.ts:330-333` there is a comment for an entry that does
not exist, immediately followed by the default:

```ts
  // Feedback system - INCREASED from 5 to 10

  // Default for unlisted endpoints
  default: { maxRequests: 30 },
};
```

So `feedback-api` silently falls through to `default: { maxRequests: 30 }`,
while the comment claims a limit of 10. `referral-api` and `user-data-api` have
no entry either — but since they are not wrapped at all, today they get *no*
limit whatsoever, not even the default.

Nearby entries show the house style, including the practice of explaining the
number in a comment (`netlify/lib/rate-limiter.ts:301-302`):

```ts
  // Fan-out endpoint: 1 request → up to 10 downstream AI calls, so keep tight.
  "batch-api": { maxRequests: 5 },
```

### Test conventions

All three endpoints already have test files:
`netlify/functions/__tests__/feedback-api.test.ts`,
`referral-api.test.ts`, `user-data-api.test.ts`.

`netlify/functions/__tests__/batch-api.test.ts:107-109` shows the assertion
used elsewhere to prove a handler is actually going through the limiter — the
limiter logs a fail-open warning when Upstash is not configured (which is the
case in the test env):

```ts
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Upstash not configured — allowing request to batch-api')
    );
```

That warning string is the observable signal that `withRateLimit` ran. Use the
same technique, substituting each endpoint's name.

**Important**: the limiter is designed to **fail open** when Upstash is not
configured (this was a deliberate fix — a misconfigured Upstash must never
block all traffic). So wrapping these handlers does not change behaviour in the
test environment or in any environment without Upstash env vars. Do not
"improve" this to fail closed.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run type:check` | exit 0, no errors |
| The three test files | `npx vitest run netlify/functions/__tests__/feedback-api.test.ts netlify/functions/__tests__/referral-api.test.ts netlify/functions/__tests__/user-data-api.test.ts` | all pass |
| Rate-limiter tests | `npx vitest run netlify/lib/__tests__/rate-limiter.test.ts` | all pass |
| Lint | `npm run lint` | exit 0 |
| Full suite | `npm run test` | exit 0 (181 files, 1774 passed, 2 skipped) |

The full suite takes ~12 minutes. Run it once at the end.

## Scope

**In scope:**
- `netlify/functions/feedback-api.ts`
- `netlify/functions/referral-api.ts`
- `netlify/functions/user-data-api.ts`
- `netlify/lib/rate-limiter.ts` (the `ENDPOINT_RATE_LIMITS` object and the stale comment only)
- `netlify/functions/__tests__/feedback-api.test.ts`
- `netlify/functions/__tests__/referral-api.test.ts`
- `netlify/functions/__tests__/user-data-api.test.ts`
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):
- `netlify/functions/notify-waitlist.ts` — gated behind `requireAdminMutationGate`
  and an admin secret; not publicly reachable, deliberately unwrapped.
- `netlify/functions/cron-reset-credits.ts`, `cron-monthly-summary.ts` —
  scheduled functions. Netlify scheduled functions **cannot be invoked via a
  public URL**; wrapping them adds nothing and risks breaking the crons.
- `netlify/functions/dev-*.ts` — gated behind both an env allow-flag and the
  admin secret.
- `netlify/functions/optimize-stream.ts` — already limited via the v2
  `checkRateLimitForRequest(request, "optimize-stream")` at line 114.
- The **fail-open** behaviour of the limiter when Upstash is unconfigured, the
  `withRateLimit` implementation itself, and the generic retry/concurrency
  helpers in `rate-limiter.ts`.
- Any change to the business logic, auth checks, or response shapes of the
  three endpoints. This plan only wraps them.

## Git workflow

- Branch: `advisor/018-rate-limit-credit-endpoints`
- Conventional commits, matching `git log` style
  (e.g. `fix: repair CI test regressions`).
  Suggested: `fix(security): rate-limit feedback, referral and user-data endpoints`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Wrap `feedback-api.ts`

Add the import (matching the style of the file's other `../lib/*.js` imports):

```ts
import { withRateLimit } from "../lib/rate-limiter.js";
```

Rename the handler at line 374 from `export const handler: Handler = async (event) => {`
to `const baseHandler: Handler = async (event) => {`, and add at the end of the
file:

```ts
export const handler = withRateLimit("feedback-api", baseHandler);
```

Check the whole file for any other reference to the identifier `handler` (for
example a recursive call or a re-export) and update it to `baseHandler` if it
refers to the unwrapped function.

**Verify**: `npx vitest run netlify/functions/__tests__/feedback-api.test.ts` → all pass.

### Step 2: Wrap `referral-api.ts`

This file already declares `const handler` at line 276 and re-exports it at
line 386 via `export { handler };`. Rename the declaration to `baseHandler` and
replace the re-export with:

```ts
export const handler = withRateLimit("referral-api", baseHandler);
```

Add the `withRateLimit` import alongside the file's existing `../lib/*.js`
imports.

**Verify**: `npx vitest run netlify/functions/__tests__/referral-api.test.ts` → all pass.

### Step 3: Wrap `user-data-api.ts`

Same transformation as Step 1, using the endpoint name `"user-data-api"`.

**Verify**: `npx vitest run netlify/functions/__tests__/user-data-api.test.ts` → all pass.

### Step 4: Add deliberate limits and delete the stale comment

In `netlify/lib/rate-limiter.ts`, inside `ENDPOINT_RATE_LIMITS`, **replace** the
orphaned comment at line 330 (`// Feedback system - INCREASED from 5 to 10`)
with real entries. Follow the house style of a one-line justification above
each. Use these values:

```ts
  // Credit-awarding endpoints: a successful call can mint credits, so keep
  // them well below the generic default even though both require a valid JWT.
  "feedback-api": { maxRequests: 10 },
  "referral-api": { maxRequests: 10 },
  // Data export + account deletion. Low legitimate frequency; a tight cap
  // bounds both scraping of one's own export and repeated delete attempts.
  "user-data-api": { maxRequests: 10 },
```

Also add an entry for the endpoint that is wrapped but unlisted, since you are
already in this object and it is a one-line fix:

```ts
  // Authoritative balance read; can also realise a pending signup grant, so
  // it is not a pure read. Modest cap, well above normal UI polling.
  "user-credits": { maxRequests: 30 },
```

Do not change any existing entry's value.

**Verify**: `npx vitest run netlify/lib/__tests__/rate-limiter.test.ts` → all pass.
Then `grep -n "Feedback system - INCREASED" netlify/lib/rate-limiter.ts` → **no matches**.

### Step 5: Add a test per endpoint pinning the wrapper

In each of the three test files, add one test asserting the handler goes
through the limiter. Model it on
`netlify/functions/__tests__/batch-api.test.ts:95-109`: spy on `console.warn`,
invoke the handler with a valid event, and assert the fail-open warning was
logged with that endpoint's name.

The warning text to match is the one the limiter emits when Upstash is not
configured — confirm the exact wording by reading the implementation in
`netlify/lib/rate-limiter.ts` (search for `Upstash not configured`) rather than
copying it from this plan, in case it has been reworded.

Each test asserts `expect.stringContaining('<the warning text> feedback-api')`
(and the same for the other two endpoint names).

**Verify**: `npx vitest run netlify/functions/__tests__/feedback-api.test.ts netlify/functions/__tests__/referral-api.test.ts netlify/functions/__tests__/user-data-api.test.ts`
→ all pass, including 3 new tests.

### Step 6: Full verification

**Verify**:
- `npm run type:check` → exit 0
- `npm run lint` → exit 0
- `npm run test` → exit 0

## Test plan

- **New tests**: 3 — one per endpoint file — each asserting the request passes
  through `withRateLimit` by observing the limiter's fail-open warning.
- **Structural pattern to follow**: `netlify/functions/__tests__/batch-api.test.ts:95-109`.
- **Existing tests must keep passing unchanged.** Wrapping a handler must not
  alter status codes or bodies in the test environment, because the limiter
  fails open without Upstash. If an existing test breaks, that is a signal you
  changed behaviour — treat it as a STOP condition, not something to update the
  test for.
- Verification: the three-file vitest command above, then the full suite.

## Done criteria

ALL must hold:

- [ ] `grep -c "withRateLimit" netlify/functions/feedback-api.ts` → ≥ 2 (import + call)
- [ ] `grep -c "withRateLimit" netlify/functions/referral-api.ts` → ≥ 2
- [ ] `grep -c "withRateLimit" netlify/functions/user-data-api.ts` → ≥ 2
- [ ] `grep -n "Feedback system - INCREASED" netlify/lib/rate-limiter.ts` → no matches
- [ ] `grep -c '"feedback-api"\|"referral-api"\|"user-data-api"\|"user-credits"' netlify/lib/rate-limiter.ts` → ≥ 4
- [ ] `npm run type:check` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run test` exits 0; 3 new wrapper tests exist and pass; **no pre-existing test was modified**
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any of the three files already contains `withRateLimit` — someone fixed this
  already and the plan is stale.
- Wrapping a handler breaks an existing test. That means the limiter is not
  failing open in the test environment as expected, and the assumption this
  plan rests on ("wrapping is behaviour-neutral without Upstash") is false.
- `referral-api.ts` turns out to export `handler` from more than one place, or
  something else imports `handler` from these modules directly.
- You find that one of these endpoints is invoked internally by another
  function (server-to-server). Wrapping it would then throttle internal calls —
  report before proceeding.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **What a reviewer should scrutinise**: that the renamed `baseHandler` is what
  gets wrapped and nothing still exports the raw function; and that no existing
  test file was edited (only added to).
- The limits chosen here are deliberately conservative. If product telemetry
  later shows legitimate users hitting the `user-data-api` cap during a large
  export, raise that one entry rather than removing the wrapper.
- Any **new** Netlify function should be wrapped at creation. The reason three
  slipped through is that wrapping is opt-in per file with nothing enforcing
  it. A follow-up worth considering (explicitly **not** in this plan): a test
  that enumerates `netlify/functions/*.ts` and asserts each exported handler is
  either wrapped or on an allowlist of deliberately-unwrapped functions
  (crons, dev tools, admin-gated). That would make this class of miss
  impossible rather than merely fixed once.
- Do not "fix" the limiter's fail-open behaviour when Upstash is unconfigured.
  It is deliberate and was itself the fix for an outage in which a
  misconfigured Upstash 503'd every request.
