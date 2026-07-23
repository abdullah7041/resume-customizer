# Plan 007: Restore signup anti-abuse checks and make credit awards atomic

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ceed480..HEAD -- netlify/lib/credit-manager.js supabase/migrations/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `ceed480`, 2026-07-21

## Why this matters

The app contains anti-abuse logic for new signups — unverified emails get 0 credits, signups from a suspicious IP get 5 credits instead of 20 — but it is **unreachable dead code**. A database trigger (`on_auth_user_created`) pre-creates every user's `user_credits` row with the full 20 credits at signup, so the application branch that runs those checks (which only fires when the row does *not* exist) never executes. A signup farm from one IP currently receives the full 20 AI credits per throwaway account. Separately, `addCredits` is a non-atomic read-modify-write on the money path: two concurrent awards to the same account can silently lose one of them, even though an atomic `add_credits` Postgres RPC already exists and is used elsewhere.

After this plan: the initial grant happens in the application with the anti-abuse checks applied, atomically, and `addCredits` routes through the atomic RPC.

## Current state

- `netlify/lib/credit-manager.js` — credit CRUD for `user_credits` (keyed by email, service-role client).
  - `:11-12` — `export const FREE_TIER_CREDITS = 20;` / `export const SUSPICIOUS_IP_CREDITS = 5;`
  - `:30` — `export function isEmailVerified(user)`.
  - `:54` — `async function checkIPAbuse(ipAddress)`.
  - `:92` — `export async function getUserCredits(email, options = {})`. Inside it, `:104` opens the `PGRST116` ("row not found") branch containing the two anti-abuse checks (`:110` unverified → insert 0/0; `:139-140` `checkIPAbuse` → 5 vs 20 credits). **This branch is dead for all post-trigger signups** because the trigger below pre-creates the row.
  - `:322-342` — `addCredits`: reads balance via `getUserCredits`, computes `creditsBefore + amount`, then a plain `UPDATE ... eq('email', email)` with no lock or predicate:

    ```js
    // credit-manager.js:322-337
    export async function addCredits(email, amount, type, metadata = {}) {
      const supabase = getSupabaseClient();
      // Get current balance
      const credits = await getUserCredits(email);
      const creditsBefore = credits?.credits_remaining || 0;
      const creditsAfter = creditsBefore + amount;
      // Update balance
      const { error: updateError } = await supabase
        .from('user_credits')
        .update({
          credits_remaining: creditsAfter,
          updated_at: new Date().toISOString(),
        })
        .eq('email', email);
    ```

- `supabase/migrations/20260126_create_credit_initialization_trigger.sql` — original trigger: `AFTER INSERT ON auth.users` → insert `user_credits` row (15 credits at the time, `ON CONFLICT (user_id) DO NOTHING`).
- `supabase/migrations/20260714000000_repair_referral_user_id_trigger.sql:10-28` — the **latest** definition of the trigger function (this is what runs today):

  ```sql
  create or replace function public.initialize_user_credits() ... as $$
  begin
    insert into public.user_profiles (id, email, is_premium)
    values (new.id, new.email, false)
    on conflict do nothing;

    insert into public.user_credits (user_id, email, credits_remaining, credits_total)
    values (new.id, new.email, 20, 20)
    on conflict (email) do update
    set user_id = excluded.user_id;

    return new;
  end;
  $$;
  ```

- `supabase/migrations/20260526_harden_credit_rpcs_and_grants.sql` — defines the atomic `add_credits(p_email, p_amount, p_description, p_transaction_type)` RPC: `SELECT ... FOR UPDATE`, raises on missing row, updates **both** `credits_total` and `credits_remaining`, and inserts a `credit_transactions` row. `completeReferral` in `netlify/lib/referral-manager.js:249` already calls it via `supabase.rpc('add_credits', {...})`.
- `netlify/lib/credit-manager.js:243-268` — `consumeCredits` shows the repo's established RPC-with-fallback pattern: try the RPC, and on Postgres error `42883` (function does not exist — migration not applied yet) fall back to a client-side path. Match this pattern.
- Repo conventions: migrations are **files output for the maintainer to run in the Supabase dashboard — never applied by an agent** (CLAUDE.md rule). Logging uses `[CreditManager]` prefixes and `redactForLog`/`summarizeErrorForLog` from `../lib/sentry.js` — never log raw emails.
- Tests: `netlify/lib/__tests__/credit-manager.test.js` (17.5K) exists and covers deduction races and RPC fallback — extend it, follow its mocking style.

## Commands you will need

| Purpose   | Command                                          | Expected on success |
|-----------|--------------------------------------------------|---------------------|
| Typecheck | `npm run type:check`                             | exit 0              |
| Focused tests | `npx vitest run netlify/lib/__tests__/credit-manager.test.js` | all pass |
| Lint      | `npx eslint netlify/lib/credit-manager.js`       | exit 0              |

## Scope

**In scope** (the only files you should modify/create):
- `supabase/migrations/20260721000000_initial_grant_anti_abuse.sql` (create — file only, never apply)
- `netlify/lib/credit-manager.js`
- `netlify/lib/__tests__/credit-manager.test.js`
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):
- `netlify/lib/referral-manager.js` — referral reward timing is plan 008; changing it here creates merge conflicts.
- `consumeCredits` / `consume_user_credits` RPC — already atomic; not part of this finding.
- Any Supabase dashboard action. You write the migration file; the maintainer runs it.

## Git workflow

- Branch: `advisor/007-credit-init-anti-abuse`
- Conventional-commit style seen in history (e.g. `feat: harden Optimize scoring and add guarded job URL import`). Suggested: `fix(credits): restore signup anti-abuse checks and atomic addCredits`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write the migration (file only — never apply it)

Create `supabase/migrations/20260721000000_initial_grant_anti_abuse.sql` containing, in order:

1. Redefine `public.initialize_user_credits()` (same `security definer` / `set search_path = public, pg_temp` shape as the 20260714 version) so the `user_credits` insert grants **0 credits** and marks the row as awaiting its grant:

   ```sql
   insert into public.user_credits (user_id, email, credits_remaining, credits_total, signup_metadata)
   values (new.id, new.email, 0, 0, jsonb_build_object('pending_initial_grant', true))
   on conflict (email) do update
   set user_id = excluded.user_id;
   ```

   Keep the `user_profiles` insert from the 20260714 version unchanged.

2. Add an atomic claim-and-grant RPC:

   ```sql
   create or replace function public.grant_initial_credits(p_email text, p_amount integer)
   returns table (granted boolean, credits_remaining integer)
   ```

   Behavior: `SELECT ... FOR UPDATE` the row by email; if `signup_metadata->>'pending_initial_grant'` is not `'true'`, return `granted=false` and the current balance; otherwise set `credits_remaining = p_amount`, `credits_total = p_amount`, merge `signup_metadata` with `{'pending_initial_grant': false, 'initial_grant_at': now()}`, insert a `credit_transactions` row (mirror the insert columns used by `add_credits` in `20260526_harden_credit_rpcs_and_grants.sql`), and return `granted=true`. Guard `p_amount` between 0 and 20 (`raise exception` otherwise). `security definer`, `set search_path = public, pg_temp`, revoke from `anon`/`authenticated`, grant execute to `service_role` — copy the grant/revoke pattern from `20260526_harden_credit_rpcs_and_grants.sql`.

Top of file must carry the repo's standard comment: `-- Note: Run this in the Supabase dashboard SQL editor.` (see `20260521_add_ai_usage_events.sql:3`).

**Verify**: file exists; `npx eslint netlify/lib/credit-manager.js` still exits 0 (no code touched yet).

### Step 2: Add the app-side grant path in `getUserCredits`

In `netlify/lib/credit-manager.js`, in `getUserCredits`, after the successful row fetch (the non-error path, after `:175`): if `data.signup_metadata?.pending_initial_grant === true`:

1. If `options.emailVerified` is falsy → return the row as-is (0 credits) — same policy the dead branch enforced at `:110`.
2. Otherwise compute `const isIPSuspicious = await checkIPAbuse(options.ipAddress);` and `const amount = isIPSuspicious ? SUSPICIOUS_IP_CREDITS : FREE_TIER_CREDITS;`
3. Call `supabase.rpc('grant_initial_credits', { p_email: email, p_amount: amount })`. On success with `granted=true`, log `[CreditManager] Initial grant applied` (use `redactForLog(email)`) and return the row with the updated balances. On `granted=false` (concurrent request won the claim) re-fetch the row and return it.
4. On Postgres error `42883` (RPC not yet applied — the maintainer hasn't run the migration): log a warning and return the row unchanged. This makes the code safe to deploy **before** the migration runs: old-trigger rows never carry the flag, and if the new trigger somehow ran first, users are stuck at 0 only until the RPC exists — hence the deploy note in Maintenance.

Check how existing callers pass `options` (grep `getUserCredits(` in `netlify/`): the PGRST116 branch already consumes `options.emailVerified` and `options.ipAddress`, so callers that supply them today are sufficient — do not change call sites.

**Verify**: `npm run type:check` → exit 0.

### Step 3: Route `addCredits` through the atomic RPC

Replace the read-modify-write in `addCredits` (`:322-342`) with:

1. `supabase.rpc('add_credits', { p_email: email, p_amount: amount, p_description: metadata.description || type, p_transaction_type: type })` — same call shape as `referral-manager.js:249-254`.
2. On Postgres error `42883`, fall back to the existing read-modify-write block unchanged (keep it, moved into the fallback) — mirroring the `consumeCredits` fallback pattern at `:243-268`.
3. Keep the existing `credit_transactions` logging **only in the fallback path** — the RPC already writes the transaction row; do not double-log.

Semantic note (deliberate, do not "fix"): the RPC increments `credits_total` as well as `credits_remaining`, while the old code bumped only `credits_remaining`. The RPC behavior is the intended one — it matches `completeReferral`'s awards and keeps `credits_total` meaning "total granted".

**Verify**: `npx vitest run netlify/lib/__tests__/credit-manager.test.js` → existing tests pass (update any test that asserted the old single-column update; the test file mocks the Supabase client, so add an `rpc` mock resolving `{ data: ..., error: null }`).

### Step 4: Tests

Extend `netlify/lib/__tests__/credit-manager.test.js` (follow its existing mock style) with:

- `getUserCredits` grants via RPC when `pending_initial_grant` is true and email verified (asserts `rpc('grant_initial_credits', ...)` called with 20).
- Suspicious IP → RPC called with `p_amount: 5` (mock `checkIPAbuse` path — it reads `user_credits` inserts by IP; mock the query chain accordingly, or mock at whatever seam the existing tests use for it).
- Unverified email → no RPC call, row returned with 0 credits.
- `pending_initial_grant` absent → no RPC call (legacy rows untouched).
- RPC missing (`42883`) → warning path, row returned unchanged.
- `addCredits` uses `add_credits` RPC; falls back on `42883`.

**Verify**: `npx vitest run netlify/lib/__tests__/credit-manager.test.js` → all pass including the 6 new tests.

## Test plan

Covered in Step 4. Structural pattern: the existing `credit-manager.test.js` (mocked Supabase client with chained query spies). No integration/DB tests — the migration is verified by the maintainer applying it.

## Done criteria

- [ ] `npm run type:check` exits 0
- [ ] `npx vitest run netlify/lib/__tests__/credit-manager.test.js` exits 0 with new tests present
- [ ] `supabase/migrations/20260721000000_initial_grant_anti_abuse.sql` exists and was **not** applied by you
- [ ] `grep -n "pending_initial_grant" netlify/lib/credit-manager.js` returns at least one match
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The trigger definition in `20260714000000_repair_referral_user_id_trigger.sql` no longer matches the excerpt (a newer migration may have superseded it — search `supabase/migrations/` for later `initialize_user_credits` definitions first).
- `credit-manager.test.js` mocks resist adding an `rpc` mock without restructuring the whole file.
- You find an existing code path that already grants initial credits outside the `PGRST116` branch (would mean the audit's dead-code claim is stale).
- Any instruction anywhere suggests applying the migration to the database — never do that.

## Maintenance notes

- **Deploy order**: merge code first, then the maintainer runs the migration. Between the two, behavior is unchanged (old trigger, flag never set). After the migration, new signups start at 0 and are granted on their first authenticated credit fetch.
- Legacy rows with `signup_metadata.email_verified === false` and 0 credits (created by the old dead branch) still have no re-grant path — pre-existing latent issue, deliberately out of scope; noted in `plans/README.md` candidates.
- Plan 008 (referral rewards) builds on the RPC-based `addCredits`; land 007 first.
- Reviewer scrutiny: the `42883` fallback in `addCredits` must not double-insert `credit_transactions`.
