# Plan 001: Enforce credit consumption results in the optimize endpoints

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat baebbd7..HEAD -- netlify/functions/optimize.ts netlify/functions/optimize-stream.ts netlify/lib/credit-manager.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (billing correctness)
- **Planned at**: commit `baebbd7`, 2026-07-08

## Why this matters

The optimize endpoints charge 5 credits per run, but three defects mean the charge is not actually enforced:

1. `consumeCredits()` can return `{ success: false }` (balance raced to zero between the pre-check and the post-AI consumption), and **both** optimize endpoints ignore that flag — the user receives the full paid optimization for free, plus a `creditsRemaining` value that was never decremented.
2. When the `consume_user_credits` RPC is missing, the fallback update uses optimistic locking, but a lost race matches 0 rows, produces no error, and the function still reports `success: true` — a silent free consumption.
3. The `emailVerified` boolean that gates the "0 credits until email verified" anti-abuse branch is computed with an expression that is effectively always `true`, so that anti-abuse branch is unreachable.

Fixing these closes real revenue leaks and reactivates an existing anti-abuse control.

## Current state

Relevant files:

- `netlify/functions/optimize.ts` — legacy (Netlify v1) optimize endpoint. Pre-check at lines 97–113, consumption at lines 361–365, `emailVerified` at line 88.
- `netlify/functions/optimize-stream.ts` — SSE (Netlify v2) optimize endpoint. `emailVerified` at line 144, consumption at lines 303–306, result caching at ~line 368, result event after that.
- `netlify/lib/credit-manager.js` — `checkCredits` / `consumeCredits`. Insufficient-balance return at lines 224–228, RPC-missing fallback at lines 240–255, final return at line ~297.

Excerpts as of commit `baebbd7`:

`netlify/functions/optimize.ts:88`:
```ts
const emailVerified = user?.email_confirmed_at !== null || (user as any)?.email_verified !== false;
```
Supabase user objects expose `email_confirmed_at` as `string | undefined` (it is `undefined`, not `null`, when unconfirmed) and have no `email_verified` field, so both operands are always `true`. The identical line exists at `netlify/functions/optimize-stream.ts:144`.

`netlify/functions/optimize.ts:99-111` (pre-check, response shape to reuse):
```ts
const creditCheck = freePreview || !userEmail
  ? { hasCredits: true, required: 0, available: 0 }
  : await checkCredits(userEmail, 'optimize', { ipAddress, emailVerified });

if (!creditCheck.hasCredits) {
  return {
    statusCode: 403,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      error: "Insufficient credits",
      creditsRequired: creditCheck.required,
      creditsAvailable: creditCheck.available,
      creditsNeeded: creditCheck.required - creditCheck.available
    })
  };
}
```

`netlify/functions/optimize.ts:361-365` (consumption result ignored):
```ts
// Consume credits AFTER successful optimization
const creditResult = freePreview || !userEmail
  ? { creditsRemaining: null }
  : await consumeCredits(userEmail, 'optimize');

const responsePayload = {
```

`netlify/functions/optimize-stream.ts:303-306` (same pattern, inside the `ReadableStream` `start()` body):
```ts
// Consume credits after successful optimization
const creditResult = freePreview || !userEmail
  ? { creditsRemaining: null }
  : await consumeCredits(userEmail, "optimize");
```
After this, the stream calls `await setCached(cacheKey, resultPayload, OPTIMIZE_CACHE_TTL_SECONDS)` and then enqueues `sseEvent("result", resultPayload)` and `sseEvent("done", ...)`.

`netlify/lib/credit-manager.js:224-228` (the `success: false` contract):
```js
const check = await checkCredits(email, feature);
if (!check.hasCredits) {
  console.warn(`[CreditManager] Insufficient credits for ${feature}. Required: ${check.required}, Available: ${check.available}`);
  return { success: false, creditsRemaining: check.available };
}
```

`netlify/lib/credit-manager.js:240-255` (RPC-missing fallback; 0-row match slips through):
```js
if (updateError && updateError.code === '42883') {
  console.log('[CreditManager] RPC not found, using direct update');
  const { error: directUpdateError } = await supabase
    .from('user_credits')
    .update({
      credits_remaining: creditsAfter,
      updated_at: new Date().toISOString(),
    })
    .eq('email', email)
    .eq('credits_remaining', creditsBefore); // Optimistic locking

  if (directUpdateError) {
    console.error('[CreditManager] Failed to consume credits:', summarizeErrorForLog(directUpdateError));
    throw new Error('Failed to consume credits');
  }
}
```
A Supabase update that matches 0 rows returns `error: null`, so a lost optimistic-lock race falls through to the `return { success: true, creditsRemaining: creditsAfter }` at the end of the function without deducting anything.

Repo conventions that apply:

- Never use `any`; logging uses `[ComponentName]` prefixes; error objects include `status`, `code`, `message` (see CLAUDE.md).
- Supabase query builder returns a `PromiseLike` — fire-and-forget must be wrapped `Promise.resolve(...).catch(...)`; the existing wrap at `credit-manager.js:262-279` is the exemplar.
- SSE events in `optimize-stream.ts` are produced by the local `sseEvent(name, payload)` helper — follow the existing `catch` block near line 384 for the error-event shape (`{ error, retryable }`).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `npm run type:check` | exit 0 |
| Focused tests | `npm run test -- netlify/lib/__tests__/credit-manager.test.js netlify/functions/__tests__/optimize.test.ts netlify/functions/__tests__/optimize-stream.test.ts` | all pass |
| Lint touched files | `npm run lint:fix` | exit 0 |

Do NOT run `npm run quality:parallel` in-agent (documented wall-clock problem in CLAUDE.md); run `npm run lint`, `npm run type:check`, `npm run test` as separate commands if a broad gate is needed.

## Scope

**In scope** (the only files you should modify):
- `netlify/lib/credit-manager.js`
- `netlify/functions/optimize.ts`
- `netlify/functions/optimize-stream.ts`
- `netlify/lib/__tests__/credit-manager.test.js`
- `netlify/functions/__tests__/optimize.test.ts`
- `netlify/functions/__tests__/optimize-stream.test.ts`

**Out of scope** (do NOT touch, even though they look related):
- `src/services/api.js` and any frontend file — client-side handling of a 403/error is already in place for the pre-check path.
- Cache-key construction or cache/credit ordering in either endpoint — that is Plan 002; do not "fix" it while here.
- `netlify/lib/referral-manager.js` — Plan 004.
- The Supabase `consume_user_credits` RPC / any SQL migration. If a DB change seems needed, STOP.

## Git workflow

- Branch: `advisor/001-enforce-credit-consumption` off the current branch's base (`main`).
- Commit style: short imperative subject, matching repo history (e.g. "Harden optimize score verification").
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Make the optimistic-lock fallback detect a lost race

In `netlify/lib/credit-manager.js` (lines 240–255 excerpt above), change the direct-update fallback to request the updated rows and treat an empty result as failure:

```js
const { data: directUpdateRows, error: directUpdateError } = await supabase
  .from('user_credits')
  .update({
    credits_remaining: creditsAfter,
    updated_at: new Date().toISOString(),
  })
  .eq('email', email)
  .eq('credits_remaining', creditsBefore) // Optimistic locking
  .select('credits_remaining');

if (directUpdateError) {
  // ... keep existing throw ...
}
if (!directUpdateRows || directUpdateRows.length === 0) {
  console.warn(`[CreditManager] Optimistic lock lost for ${feature} — balance changed concurrently, no deduction applied`);
  return { success: false, creditsRemaining: creditsBefore };
}
```

Note the early `return` must happen BEFORE the transaction-log insert and the `completeReferral` trigger further down — nothing was consumed, so neither should run.

**Verify**: `npm run test -- netlify/lib/__tests__/credit-manager.test.js` → existing tests pass (the fallback-path test mocks the update; you may need to extend the mock chain with `.select()` — do that in the test, keeping its assertions).

### Step 2: Add and use a real email-verification predicate

In `netlify/lib/credit-manager.js`, export a small helper near the top-level exports:

```js
/**
 * True when the Supabase auth user has a confirmed email.
 * Supabase sets email_confirmed_at to an ISO string on confirmation;
 * it is undefined/null otherwise.
 */
export function isEmailVerified(user) {
  return Boolean(user?.email_confirmed_at);
}
```

Then in `netlify/functions/optimize.ts:88` and `netlify/functions/optimize-stream.ts:144`, replace the broken expression with:

```ts
const emailVerified = isEmailVerified(user);
```

importing `isEmailVerified` alongside the existing `checkCredits`/`consumeCredits` imports from `../lib/credit-manager.js`.

**Verify**: `npm run type:check` → exit 0. `grep -rn "email_verified !== false" netlify/` → no matches.

### Step 3: Enforce the consumption result in optimize.ts

At `netlify/functions/optimize.ts:361-365`, after `creditResult` is computed, add:

```ts
if (!freePreview && userEmail && creditResult.success === false) {
  console.warn('[optimize] Credit consumption failed post-generation — balance raced to insufficient');
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

(Shape mirrors the pre-check 403 at lines 99–111 so the frontend handles it identically.) IMPORTANT: this early return must occur BEFORE `setCached(...)` is called for this response (the cache write is currently near line 445) — an unpaid result must not become retrievable from cache.

**Verify**: `npm run test -- netlify/functions/__tests__/optimize.test.ts` → pass (plus the new test from the Test plan below).

### Step 4: Enforce the consumption result in optimize-stream.ts

At `netlify/functions/optimize-stream.ts:303-306`, after `creditResult`, add the equivalent guard. In the stream context you cannot return a Response; instead emit an SSE error and stop:

```ts
if (!freePreview && userEmail && (creditResult as { success?: boolean }).success === false) {
  console.warn('[optimize-stream] Credit consumption failed post-generation — balance raced to insufficient');
  controller.enqueue(
    encoder.encode(
      sseEvent("error", {
        error: "Insufficient credits",
        retryable: false,
      })
    )
  );
  return; // finally block closes the controller
}
```

This must run BEFORE the `setCached(cacheKey, resultPayload, ...)` call and before the `result` event is enqueued — an unpaid result must be neither cached nor delivered.

**Verify**: `npm run test -- netlify/functions/__tests__/optimize-stream.test.ts` → pass (plus new test below).

## Test plan

Model new tests after the existing structure in each file (they mock `openrouter-client`/`gemini-client` and the credit manager boundary).

1. `netlify/lib/__tests__/credit-manager.test.js`: new test — RPC returns error code `42883`, direct update resolves with `data: []` → `consumeCredits` returns `{ success: false }`, and the `credit_transactions` insert is NOT called.
2. `netlify/lib/__tests__/credit-manager.test.js`: unit tests for `isEmailVerified` — `{ email_confirmed_at: '2026-01-01T00:00:00Z' }` → true; `{}`, `{ email_confirmed_at: null }`, `undefined` → false.
3. `netlify/functions/__tests__/optimize.test.ts`: mock `consumeCredits` to resolve `{ success: false, creditsRemaining: 0 }` → handler returns 403 with `error: "Insufficient credits"`, and `setCached` is not called with the response payload.
4. `netlify/functions/__tests__/optimize-stream.test.ts`: same mock → SSE stream contains an `error` event and NO `result` event; `setCached` not called.

Verification: `npm run test -- netlify/lib/__tests__/credit-manager.test.js netlify/functions/__tests__/optimize.test.ts netlify/functions/__tests__/optimize-stream.test.ts` → all pass including the 4+ new tests.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run type:check` exits 0
- [ ] Focused test command above exits 0; new tests listed in the Test plan exist and pass
- [ ] `grep -rn "email_verified !== false" netlify/` → no matches
- [ ] `grep -n "success === false" netlify/functions/optimize.ts netlify/functions/optimize-stream.ts` → one match in each file
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Excerpts above don't match the live code (drift since `baebbd7`).
- `consumeCredits`'s return contract is not `{ success, creditsRemaining }` as excerpted (someone changed the API).
- Fixing the 0-row fallback appears to require a DB migration or RPC change.
- The optimize-stream `start()` structure has been refactored such that there is no single post-consumption point before `setCached`/`result`.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Plan 002 reorders cache/credit logic in the same two endpoints — land this plan first; 002's diff assumes the `success === false` guards exist.
- Reviewer should scrutinize: the 403 is returned *after* the AI generation succeeded, so the user "loses" the generation — that is intentional (they didn't pay). Confirm product is OK with that trade-off vs. delivering unpaid output.
- Deferred: distinguishing transient consumption errors (thrown) from insufficient balance (`success:false`) — thrown errors already bubble to the endpoint's catch and are fine as-is.
