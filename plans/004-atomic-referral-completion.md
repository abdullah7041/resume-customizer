# Plan 004: Make completeReferral claim-then-award (atomic, race-safe)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat baebbd7..HEAD -- netlify/lib/referral-manager.js`
> If the file changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (payout race, mostly-legacy path)
- **Planned at**: commit `baebbd7`, 2026-07-08

## Why this matters

`completeReferral()` (called on every paid credit consumption via `credit-manager.js:286-288`) is check-then-act: it reads `referral_completed`, awards credits to referrer AND referee, and only afterwards flips `referral_completed = true`. Two concurrent paid actions by the same referee can both pass the read, both award 5+5 credits, and both flip the flag — a doubled payout.

Reachability caveat (be honest about impact): the newer `trackReferral()` in the same file already sets `referral_completed: true` at claim time AND pays both rewards immediately, so for referrals created through the current flow, `completeReferral` early-returns and the race is unreachable. It remains reachable for legacy rows where `referred_by_user_id` is set but `referral_completed` is still false. The fix is cheap and the same file already contains the correct pattern to copy, so close the hole rather than reason about how many legacy rows exist.

## Current state

Relevant file: `netlify/lib/referral-manager.js` — referral tracking and rewards. `trackReferral` (atomic exemplar) at lines 90–131; `completeReferral` (the defect) at lines 190–267.

Excerpts as of commit `baebbd7`:

The correct pattern already in the file — `trackReferral` claims atomically and only pays if the conditional write returned the row (`referral-manager.js:90-110`):
```js
// Atomically claim the referral relationship. Rewards are only paid when this
// conditional write returns the referee row, preventing retry/double-award races.
const { data: trackedReferral, error: updateError } = await supabase
  .from('user_credits')
  .update({
    referred_by_user_id: referrerUserId,
    referral_completed: true,
    referral_completed_at: new Date().toISOString()
  })
  .eq('user_id', refereeUserId)
  .is('referred_by_user_id', null)
  .is('referred_by_email', null)
  .select('email')
  .maybeSingle();
...
if (!trackedReferral) { ... return { success: false, ... }; }
```

The defect — `completeReferral` reads, awards, then flips (`referral-manager.js:195-261`, abridged):
```js
const { data: refereeData, error: fetchError } = await supabase
  .from('user_credits')
  .select('referred_by_user_id, referral_completed')
  .eq('email', refereeEmail)
  .single();
...
if (!referrerUserId || alreadyCompleted) {
  return { completed: false };
}
... // resolve referrer email
// Award credits to referrer
const { error: referrerError } = await supabase.rpc('add_credits', { ... });
...
// Award credits to referee
const { error: refereeError } = await supabase.rpc('add_credits', { ... });
...
// Mark referral as completed   <-- happens LAST
const { error: completeError } = await supabase
  .from('user_credits')
  .update({ referral_completed: true, referral_completed_at: new Date().toISOString() })
  .eq('email', refereeEmail);
```

Caller: `netlify/lib/credit-manager.js:286-288` — `completeReferral(email)` inside a try/catch on every paid consumption; its failures are non-blocking by design. Keep that contract.

Conventions: `[ReferralManager]` log prefix; `redactForLog`/`summarizeErrorForLog` for anything containing emails or errors; no raw emails in logs.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Focused tests | `npm run test -- netlify/lib/__tests__/referral-manager.test.js` | all pass |
| Lint | `npm run lint:fix` | exit 0 |
| Typecheck (JS file — still run for the repo) | `npm run type:check` | exit 0 |

## Scope

**In scope**:
- `netlify/lib/referral-manager.js` (ONLY the `completeReferral` function)
- `netlify/lib/__tests__/referral-manager.test.js`

**Out of scope**:
- `trackReferral` — it is the exemplar, already correct; do not "unify" them.
- `netlify/lib/credit-manager.js` — the call site contract is unchanged.
- Any SQL/RPC change (`add_credits` stays as-is). If a migration seems required, STOP.
- Email notification logic at the end of `completeReferral`.

## Git workflow

- Branch: `advisor/004-atomic-referral-completion`
- Commit style: short imperative subject, matching repo history.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Reorder completeReferral to claim-then-award

Restructure `completeReferral` so the completion flag is claimed atomically FIRST, mirroring `trackReferral`:

```js
// Atomically claim completion. Rewards are only paid when this conditional
// write returns the row, preventing concurrent double-award races.
const { data: claimed, error: claimError } = await supabase
  .from('user_credits')
  .update({
    referral_completed: true,
    referral_completed_at: new Date().toISOString()
  })
  .eq('email', refereeEmail)
  .eq('referral_completed', false)
  .not('referred_by_user_id', 'is', null)
  .select('referred_by_user_id')
  .maybeSingle();

if (claimError) {
  console.error('[ReferralManager] Failed to claim referral completion:', summarizeErrorForLog(claimError));
  return { completed: false, error: 'Failed to claim completion' };
}
if (!claimed) {
  // No referral, already completed, or lost the race — all fine.
  return { completed: false };
}
const referrerUserId = claimed.referred_by_user_id;
```

Then keep the existing referrer-email resolution and the two `add_credits` RPC calls, followed by the existing email notifications and the `{ completed: true, referrerReward, refereeReward }` return. Delete the old initial `select('referred_by_user_id, referral_completed')` read and the old trailing "Mark referral as completed" update (both replaced by the claim).

Failure handling after a successful claim: if either `add_credits` RPC fails, log with `summarizeErrorForLog` and return `{ completed: false, error: 'Reward payment failed after claim' }` — do NOT un-flip `referral_completed` (re-opening it would re-arm the race; a claimed-but-unpaid row is a log-visible support case, not an exploit).

**Verify**: `npm run test -- netlify/lib/__tests__/referral-manager.test.js` → existing tests pass (update mocks: the first DB call is now an `update(...).eq(...).eq(...).not(...).select(...).maybeSingle()` chain).

### Step 2: Cover the race in tests

Add to `netlify/lib/__tests__/referral-manager.test.js` (model after the existing `trackReferral` race tests in the same file):

1. Claim returns a row → both `add_credits` RPCs called once each; result `{ completed: true, ... }`.
2. Claim returns `null` (already completed / lost race) → NO `add_credits` call; result `{ completed: false }` with no `error`.
3. Claim returns a row, first `add_credits` rejects → result `{ completed: false, error: ... }`, second award not attempted or attempted per your implementation (assert whichever the implementation does — but assert `referral_completed` is never reset).

**Verify**: `npm run test -- netlify/lib/__tests__/referral-manager.test.js` → all pass including 3 new tests.

## Done criteria

- [ ] `npm run test -- netlify/lib/__tests__/referral-manager.test.js` exits 0, including the 3 new tests
- [ ] `npm run type:check` exits 0
- [ ] In `completeReferral`, the `referral_completed: true` update precedes both `add_credits` calls (visual check: `grep -n "add_credits\|referral_completed" netlify/lib/referral-manager.js` shows the claim before the RPCs within the function)
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The `completeReferral` body no longer matches the excerpt (drift).
- The `user_credits` schema apparently lacks `referral_completed` / `referred_by_user_id` as used here (mock expectations in existing tests will reveal this) — schema questions are out of an executor's scope.
- Someone has removed the `completeReferral` call from `credit-manager.js` entirely (function may be dead — report instead of fixing dead code).
- A step's verification fails twice.

## Maintenance notes

- If `completeReferral` is confirmed fully dead (all rows migrated, `trackReferral` is the only flow), the better long-term move is deleting it and its call site — that decision needs the owner's confirmation about legacy rows in production, which is why this plan hardens instead of deletes.
- Reviewer: scrutinize the `.not('referred_by_user_id', 'is', null)` guard — it encodes "only rows with a referrer can complete", replacing the old explicit check.
