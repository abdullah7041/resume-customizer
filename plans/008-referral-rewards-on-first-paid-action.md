# Plan 008: Pay referral rewards on first paid action, not at signup

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ceed480..HEAD -- netlify/lib/referral-manager.js netlify/functions/referral-api.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/007-restore-credit-init-anti-abuse.md
- **Category**: security
- **Planned at**: commit `ceed480`, 2026-07-21

## Why this matters

Referral rewards (5 credits to referrer + 5 to referee) are paid **immediately when a referral code is claimed at signup**. The only guard is a self-referral check, so a ring of N throwaway accounts referring each other (A→B→C→…) farms 10 credits per link with zero real usage — on top of the signup grant. The codebase already contains the correct model: `completeReferral` is written to pay rewards atomically on the referee's **first paid credit consumption**, and `consumeCredits` already calls it. But it is dead code: its claim predicate requires `referral_completed = false` with a referrer set, and the only writer of the referrer column sets `referral_completed = true` in the same UPDATE, so the predicate never matches. This plan flips reward payment to the intended first-paid-action model by making `trackReferral` claim-without-paying, which simultaneously revives `completeReferral`. It also fixes a read-then-write race in referral-code generation.

## Current state

- `netlify/lib/referral-manager.js` — referral logic on `user_credits` columns `referral_code`, `referred_by_user_id`, `referral_completed`, `referral_completed_at`.
  - `:13-14` — `const REFERRER_REWARD = 5; const REFEREE_REWARD = 5;`
  - `:85-88` — self-referral guard (email or user-id match) — the **only** abuse guard.
  - `:92-103` — `trackReferral`'s claim UPDATE. This is the bug site — it sets `referral_completed: true` at claim time:

    ```js
    // referral-manager.js:92-103
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
    ```

  - `:134-153` — immediate payment at claim: `addCredits(referrerEmail, REFERRER_REWARD, 'referral_reward', ...)` and `addCredits(refereeEmail, REFEREE_REWARD, 'referral_reward', ...)`, each in its own try/catch.
  - `:156-165` — reward emails (`sendReferralRewardReferrer` / `sendReferralRewardReferee`) sent at claim time, fire-and-forget.
  - `:210-220` — `completeReferral`'s atomic claim (the intended payment point, currently unreachable):

    ```js
    // referral-manager.js:210-220
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
    ```

  - `:249-275` — on successful claim, pays both parties via the atomic `add_credits` RPC, with `reopenClaimForRetry()` compensation if the referrer payment fails.
- `netlify/lib/credit-manager.js:298-309` — `consumeCredits` already invokes `completeReferral(email)` (non-blocking) whenever `creditsToConsume > 0`. No change needed there.
- `netlify/functions/referral-api.ts` —
  - `:121-146` — `handleGetLink` code generation race: reads `referral_code`; if absent, generates and saves with an UPDATE that has **no** `referral_code IS NULL` predicate:

    ```ts
    // referral-api.ts:135-146 (update lacks a null-guard predicate)
    const { data: savedRow, error: updateError } = await supabase
        .from('user_credits')
        .update({ referral_code: referralCode })
        .eq('email', email)
        .select('referral_code')
        .maybeSingle();
    ```

    Two concurrent first calls each generate a different code; last write wins, the earlier-returned code is a dead link.
  - `:314-322` — `POST {action:'track'}` → `handleTrack` → `trackReferral` for any authenticated user.
- Tests: `netlify/lib/__tests__/referral-manager.test.js` (12.5K) asserts the current claim shape (e.g. `expect(updateMock.spies.is).toHaveBeenCalledWith('referred_by_user_id', null)` and completion-claim spies at `:309`); `netlify/functions/__tests__/referral-api.test.ts` covers the API layer.
- Conventions: `[ReferralManager]` log prefix, `redactForLog` for emails, errors as `{status, code, message}`.

## Commands you will need

| Purpose   | Command                                          | Expected on success |
|-----------|--------------------------------------------------|---------------------|
| Typecheck | `npm run type:check`                             | exit 0              |
| Focused tests | `npx vitest run netlify/lib/__tests__/referral-manager.test.js netlify/functions/__tests__/referral-api.test.ts` | all pass |
| Lint      | `npx eslint netlify/lib/referral-manager.js netlify/functions/referral-api.ts` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `netlify/lib/referral-manager.js`
- `netlify/functions/referral-api.ts` (only `handleGetLink`'s code-save UPDATE)
- `netlify/lib/__tests__/referral-manager.test.js`
- `netlify/functions/__tests__/referral-api.test.ts`
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `netlify/lib/credit-manager.js` — plan 007 owns it; the `completeReferral` hook in `consumeCredits` already exists.
- `netlify/lib/email-service.js` / `email-templates.js` — reuse the existing send functions; no template changes.
- The legacy `referred_by_email` column handling — read-only compatibility checks stay as-is.

## Git workflow

- Branch: `advisor/008-referral-first-paid-action`
- Suggested commit: `fix(referrals): pay rewards on first paid action; guard code generation race`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Make `trackReferral` claim without paying

In `netlify/lib/referral-manager.js`:

1. In the claim UPDATE (`:92-103`), remove `referral_completed: true` and `referral_completed_at` — set **only** `referred_by_user_id: referrerUserId`. Keep the `.is(...)` predicates and `.select('email')` exactly as they are.
2. Delete the two `addCredits(...)` payment blocks (`:134-153`) and the `addCredits` import if now unused.
3. Move the two reward-email sends (`:156-165`) out of `trackReferral` — they now belong at completion (Step 2). In their place, keep the existing tracked log line.
4. Update `trackReferral`'s JSDoc to state: "Claims the referral relationship. Rewards are paid by `completeReferral` on the referee's first paid action."

**Verify**: `npx vitest run netlify/lib/__tests__/referral-manager.test.js` → failures ONLY in tests asserting immediate payment/completed-at-claim (fixed in Step 4).

### Step 2: Send reward emails from `completeReferral`

In `completeReferral`, after both `add_credits` RPC payments succeed (after the success log around `:275`), add the fire-and-forget email block previously in `trackReferral` (dynamic `import('./email-service.js')`, `.catch` with `summarizeErrorForLog` warnings — copy the removed block verbatim, adjusting variable names to `referrerEmail`/`refereeEmail` in scope there).

**Verify**: `npm run type:check` → exit 0 (file is JS; typecheck still catches TS-side import issues) and `npx eslint netlify/lib/referral-manager.js` → exit 0.

### Step 3: Guard the referral-code save

In `netlify/functions/referral-api.ts` `handleGetLink`, add `.is('referral_code', null)` to the UPDATE chain (between `.eq('email', email)` and `.select(...)`). Then, when `savedRow` comes back null (someone else won the race OR row missing), re-fetch `referral_code` by email: if a code now exists, return that code; if the row is truly missing, keep the existing missing-row error path. Preserve the existing comment about `.select()` verifying persistence.

**Verify**: `npx vitest run netlify/functions/__tests__/referral-api.test.ts` → pass (extend mocks if the chain now includes `.is`).

### Step 4: Update tests

- `referral-manager.test.js`:
  - Track tests: assert the claim UPDATE payload no longer contains `referral_completed` and that **no** `addCredits`/`rpc('add_credits')` call happens during `trackReferral`.
  - New test: full lifecycle — `trackReferral` claims (referrer set, completed false), then `completeReferral` claims and pays both via `rpc('add_credits', ...)` (the file already has completion-claim spies at `:309` to model from).
  - New test: reward emails triggered from completion, not track.
- `referral-api.test.ts`: code-generation race test — UPDATE with `.is('referral_code', null)` returning null → handler re-fetches and returns the concurrent winner's code.

**Verify**: `npx vitest run netlify/lib/__tests__/referral-manager.test.js netlify/functions/__tests__/referral-api.test.ts` → all pass.

## Test plan

Covered in Step 4; structural pattern is the existing `referral-manager.test.js` mock harness (chained query spies + `vi.mock` of credit-manager/email-service).

## Done criteria

- [ ] `npm run type:check` exits 0
- [ ] Focused vitest run above exits 0, including the new lifecycle + race tests
- [ ] `grep -n "referral_completed: true" netlify/lib/referral-manager.js` matches ONLY inside `completeReferral` (one site)
- [ ] `grep -n "addCredits" netlify/lib/referral-manager.js` returns no payment calls in `trackReferral`
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `completeReferral`'s claim predicate or RPC payment block (`:210-275`) doesn't match the excerpts — the intended payment point may have changed.
- You find another caller that depends on rewards being present immediately after `track` (grep `referral_reward` and `track` across `src/` and `netlify/`) — e.g. UI copy promising instant credits. Report it; the product decision (instant referee welcome vs. all-at-completion) belongs to the maintainer.
- `consumeCredits` no longer calls `completeReferral` (grep `completeReferral` in `credit-manager.js`) — the payment point would be unwired.

## Maintenance notes

- **Behavior change to announce**: referees no longer receive 5 credits at signup; both rewards arrive when the referee first spends credits. Frontend copy referencing instant rewards (check `src/components/Referrals/` and locale files for "5 credits") may need wording updates — deliberately out of scope here; flag anything found in your report.
- Depends on plan 007's `addCredits`-via-RPC only in spirit (no code dependency after Step 1 removes `addCredits` usage), but keep the execution order — 007 touches the same test file's mock setup.
- Future: a per-IP/per-account referral cap is the next hardening step if farming persists (candidates list in `plans/README.md`).
