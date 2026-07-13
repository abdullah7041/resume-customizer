# Plan 002: Unify the optimize cache key and stop serving cached credit balances

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat baebbd7..HEAD -- netlify/functions/optimize.ts netlify/functions/optimize-stream.ts netlify/lib/redis-cache.ts`
> Plan 001 intentionally modifies `optimize.ts` / `optimize-stream.ts` (consumption
> guards) — that drift is expected. Any OTHER mismatch with the "Current state"
> excerpts is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/001-enforce-credit-consumption-results.md
- **Category**: bug (caching/billing correctness)
- **Planned at**: commit `baebbd7`, 2026-07-08

## Why this matters

The two optimize endpoints (`optimize.ts` legacy v1, `optimize-stream.ts` SSE v2) share one Redis cache but have diverged in three ways:

1. **Different cache keys**: the stream key includes a per-user scope (`userId`), the legacy key does not. A result cached by one endpoint can never be found by the other, so the documented "idempotent retry without re-charge" design only works within the stream endpoint — and the legacy endpoint's key is shared across ALL users with identical resume+JD text.
2. **Different ordering**: the stream checks cache before credits (a user at 0 credits can still retrieve their already-paid result); the legacy endpoint checks credits first, so the same user gets a 403 for a result they already paid for.
3. **Stale/cross-user `creditsRemaining`**: both endpoints embed `creditsRemaining` in the payload they cache, so a cache HIT returns a credit balance snapshot that is stale (stream) or potentially another user's (legacy, because of the shared key).

After this plan: one shared key builder (user-scoped), cache-before-credits on both endpoints, and cached payloads never contain a credit balance — the live balance is attached at response time.

## Current state

Relevant files:

- `netlify/functions/optimize.ts` — legacy endpoint. Credit pre-check at lines 97–113; cache key + lookup at lines 139–160; consumption ~line 361; `setCached` ~line 445.
- `netlify/functions/optimize-stream.ts` — SSE endpoint. Cache key + lookup at lines 186–214; `cacheOnly` recovery branch right after; credit check ~line 232; result payload + `setCached` at lines 308–330.
- `netlify/lib/redis-cache.ts` — exports `buildCacheKey`, `getCached`, `setCached`. New shared builder goes here.

Excerpts as of commit `baebbd7`:

`netlify/functions/optimize.ts:139-160` (legacy: key WITHOUT user scope, lookup AFTER the credit check at 97–113):
```ts
const cacheKey = buildCacheKey('optimize', {
  resumeText: resumeText.trim(),
  jobText: jobText.trim(),
  language: language || 'en',
  vulnerabilities: vulnerabilities.map((v: any) => v.type).sort(),
  userClarifications: userClarifications || '',
  userHardStops: userHardStops || [],
});

const cachedResponse = await getCached<Record<string, unknown>>(cacheKey);
if (hasRenderableCards(cachedResponse)) {
  console.log('[optimize] Cache HIT — returning cached result, skipping Gemini call.');
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
    body: JSON.stringify(cachedResponse),
  };
}
```

`netlify/functions/optimize-stream.ts:186-196` (stream: key WITH user scope, lookup BEFORE the credit check at ~232):
```ts
const cacheKey = buildCacheKey('optimize', {
  userId: user?.id || userEmail || `free-preview:${ipAddress || 'unknown'}`,
  resumeText: resumeText.trim(),
  jobText: jobText.trim(),
  language: language || 'en',
  vulnerabilities: vulnerabilities.map((v: any) => v.type).sort(),
  userClarifications: userClarifications || '',
  userHardStops: userHardStops || [],
});
```

`netlify/functions/optimize.ts:366-383` (legacy payload embeds the balance; the whole `responsePayload` is later cached verbatim at ~line 445: `await setCached(cacheKey, responsePayload, OPTIMIZE_CACHE_TTL_SECONDS);`):
```ts
const responsePayload = {
  cards: cards,
  ...
  creditsRemaining: creditResult.creditsRemaining,
  freePreview,
  ...
```

`netlify/functions/optimize-stream.ts:322` embeds the same field in `resultPayload`, which is cached at ~line 368 and enqueued as the `result` SSE event.

The stream endpoint also has a `cacheOnly` recovery mode (client retries with `cacheOnly: true` after an ambiguous failure; a MISS returns HTTP 409 `cacheOnlyMiss: true`) — this is the consumer that most depends on key stability.

Repo conventions: no `any` in new code; `[optimize]` / `[optimize-stream]` log prefixes; `netlify/lib/redis-cache.ts` is the cache utility home.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `npm run type:check` | exit 0 |
| Focused tests | `npm run test -- netlify/functions/__tests__/optimize.test.ts netlify/functions/__tests__/optimize-stream.test.ts src/__tests__/api.optimize-stream.test.js` | all pass |
| Lint | `npm run lint:fix` | exit 0 |

## Scope

**In scope**:
- `netlify/lib/redis-cache.ts` (add `buildOptimizeCacheKey`)
- `netlify/functions/optimize.ts`
- `netlify/functions/optimize-stream.ts`
- `netlify/functions/__tests__/optimize.test.ts`
- `netlify/functions/__tests__/optimize-stream.test.ts`

**Out of scope**:
- `src/services/api.js` / any frontend file — response shape (`creditsRemaining` present on live responses) is unchanged.
- The SSE error/billing-state semantics — that is Plan 003.
- The duplicated card-building logic in the two endpoints (a known tech-debt item, deliberately not bundled here).
- Cache TTLs and `hasRenderableCards` logic.

## Git workflow

- Branch: `advisor/002-unify-optimize-cache` (branch from the result of Plan 001).
- Commit style: short imperative subject, matching repo history.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add a shared key builder

In `netlify/lib/redis-cache.ts`, add and export:

```ts
export interface OptimizeCacheKeyInput {
  userScope: string;            // user id, else email, else `free-preview:<ip|unknown>`
  resumeText: string;
  jobText: string;
  language: string;
  vulnerabilities: string[];    // sorted vulnerability type strings
  userClarifications: string;
  userHardStops: string[];
}

export function buildOptimizeCacheKey(input: OptimizeCacheKeyInput): string {
  return buildCacheKey('optimize', {
    userId: input.userScope,
    resumeText: input.resumeText.trim(),
    jobText: input.jobText.trim(),
    language: input.language || 'en',
    vulnerabilities: [...input.vulnerabilities].sort(),
    userClarifications: input.userClarifications || '',
    userHardStops: input.userHardStops || [],
  });
}
```

The field names passed to `buildCacheKey` intentionally match the CURRENT stream key composition exactly (including the `userId` property name), so existing stream cache entries remain valid.

**Verify**: `npm run type:check` → exit 0.

### Step 2: Switch both endpoints to the shared builder

- In `optimize-stream.ts:186-196`, replace the inline `buildCacheKey('optimize', {...})` with `buildOptimizeCacheKey({ userScope: user?.id || userEmail || `free-preview:${ipAddress || 'unknown'}`, ... })`.
- In `optimize.ts:139-147`, same replacement. `optimize.ts` already has `user`, `userEmail`, and `ipAddress` in scope (used at lines 86–99).

**Verify**: `grep -n "buildCacheKey('optimize'" netlify/functions/` → no matches; `grep -n "buildOptimizeCacheKey" netlify/functions/optimize.ts netlify/functions/optimize-stream.ts` → one match each. `npm run type:check` → exit 0.

### Step 3: Move the legacy endpoint's cache lookup before its credit check

In `optimize.ts`, the cache key/lookup currently sits at lines 139–160, AFTER the credit check at 97–113 — but also after Zod validation (the key needs `resumeText` etc. from `parseResult.data`). Reorder within the handler to: auth → Zod validation → vulnerability detection → cache key + lookup (return HIT immediately) → free-preview rate limit + credit check → AI call. I.e., move the credit-check block (97–113) and the free-preview rate-limit block (90–95) down to just after the cache lookup, mirroring the stream endpoint's documented ordering ("Credit check (after cache check so cached retries bypass this)").

On a cache HIT, before returning, attach a live balance (step 4 defines `attachLiveCredits`).

**Verify**: `npm run test -- netlify/functions/__tests__/optimize.test.ts` → pass. If existing tests assert the 403-before-cache ordering, update them to the new ordering (they now expect a HIT to succeed even with 0 credits).

### Step 4: Stop caching `creditsRemaining`; attach it live

In BOTH endpoints:

1. Build the payload WITHOUT `creditsRemaining` for caching. Concretely: construct the payload, then `const { creditsRemaining: _omit, ...cacheablePayload } = responsePayload;` and `setCached(cacheKey, cacheablePayload, ...)`. (In the stream endpoint the field is inside `resultPayload` at line 322.)
2. On a cache HIT, attach a live balance before responding:

```ts
async function attachLiveCredits<T extends Record<string, unknown>>(payload: T, userEmail: string | undefined, freePreview: boolean): Promise<T & { creditsRemaining: number | null }> {
  if (freePreview || !userEmail) return { ...payload, creditsRemaining: null };
  try {
    const check = await checkCredits(userEmail, 'optimize');
    return { ...payload, creditsRemaining: check.available };
  } catch {
    return { ...payload, creditsRemaining: null };
  }
}
```

Place this helper once in each endpoint file (or, if both can import it cleanly, in `netlify/lib/credit-manager.js` — executor's choice; prefer the lib if no circular import results). The MISS path keeps using `creditResult.creditsRemaining` on the live (non-cached) response exactly as today.

**Verify**: `npm run test -- netlify/functions/__tests__/optimize.test.ts netlify/functions/__tests__/optimize-stream.test.ts` → pass, plus new tests below.

## Test plan

Model after existing tests in the two function test files (they mock the AI client and `redis-cache`).

1. Key parity: unit test (in `optimize-stream.test.ts` or a small new `redis-cache` test block) asserting `buildOptimizeCacheKey` produces identical keys for identical inputs regardless of caller — and that changing `userScope` changes the key.
2. `optimize.test.ts`: with `getCached` mocked to return a renderable cached payload and `checkCredits` mocked to 0 available → handler returns 200 with the cached cards (cache-before-credits) and `creditsRemaining` equal to the live mocked balance, not any cached value.
3. `optimize.test.ts` / `optimize-stream.test.ts`: assert the object passed to `setCached` has NO `creditsRemaining` property.
4. Existing `cacheOnly` recovery tests in `optimize-stream.test.ts` still pass unchanged (key composition for the stream did not change).

Verification: focused test command from the table → all pass.

## Done criteria

- [ ] `npm run type:check` exits 0
- [ ] Focused tests pass, including the 3+ new tests
- [ ] `grep -rn "creditsRemaining" netlify/functions/optimize.ts netlify/functions/optimize-stream.ts` shows it only on live-response paths, never in an object passed to `setCached`
- [ ] Both endpoints call `buildOptimizeCacheKey`; no inline `buildCacheKey('optimize', ...)` remains in `netlify/functions/`
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- Plan 001 has not landed (no `success === false` guard present in the two endpoints) — execute 001 first.
- The stream endpoint's key composition at lines 186–196 differs from the excerpt (someone already changed key semantics — re-plan rather than guess).
- Reordering in Step 3 would move the cache lookup before Zod validation (it must not — the key depends on validated fields).
- `checkCredits` cannot be called on the HIT path without side effects beyond row initialization (read its current implementation; if it now mutates balances, STOP).
- A step's verification fails twice.

## Maintenance notes

- Changing the legacy key composition orphans pre-existing legacy cache entries; TTL is ~10 minutes, so impact evaporates quickly. Do not write migration code for cache entries.
- Plan 003 builds on this: the `cacheOnly` recovery path is only trustworthy because keys are now stable across endpoints.
- Reviewer: check the reorder in Step 3 didn't accidentally skip the free-preview rate limit for non-cached requests.
- Deferred: extracting the duplicated card-building logic (`optimize.ts:210-321` vs `optimize-stream.ts` `buildOptimizationCards`) into `netlify/lib/` — worthwhile, separate change.
