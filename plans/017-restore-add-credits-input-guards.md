# Plan 017: Restore the input guards `add_credits` lost, and make each credit migration self-valid

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d2fba38..HEAD -- supabase/migrations netlify/lib/credit-manager.js netlify/lib/__tests__/credit-manager.test.js`
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

`add_credits` is the single write path for every credit *increase* in the
product: referral rewards, feedback rewards, monthly resets, the signup grant,
and the refund fail-safes in `optimize.ts` / `optimize-stream.ts` /
`vision2030-alignment.ts`. When it was patched on 2026-07-23 to fix a missing
`feature` column, the new function body was written from an older copy and
**silently dropped two input-validation guards** that the previous version had.

The live function now accepts a blank email and a non-positive `p_amount`.
`p_amount = 0` writes a meaningless audit row; a **negative** `p_amount` is
accepted as an unbounded subtraction from `credits_remaining` with no floor —
a second, unaudited way to drain a balance that completely bypasses
`consume_user_credits`'s insufficient-funds check. No caller passes a
request-controlled amount today, so this is a latent ledger-integrity hole
rather than a live exploit — but it is the *same class* of defect that this
very migration existed to repair, and that one silently broke every reward and
refund in production for months before anyone noticed.

After this plan: `add_credits` rejects both bad inputs again, `user_credits`
carries a non-negative floor as defense-in-depth, and the migration that first
wrote `'initial_grant'` no longer depends on a later-numbered migration to make
its own writes legal.

## Current state

### The guards that exist in the superseded version

`supabase/migrations/20260526_harden_credit_rpcs_and_grants.sql:17-31` — the
version that was live until 2026-07-23:

```sql
as $$
declare
  v_current_total integer;
  v_new_total integer;
  v_current_remaining integer;
  v_new_remaining integer;
begin
  if nullif(trim(p_email), '') is null then
    raise exception 'Email is required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Credit amount must be positive';
  end if;

  select credits_total, credits_remaining
  into v_current_total, v_current_remaining
  from public.user_credits
  where email = p_email
  for update;
```

### The current live version — both guards gone

`supabase/migrations/20260723000000_fix_credit_transaction_writes.sql:39-60`:

```sql
create or replace function public.add_credits(
  p_email character varying,
  p_amount integer,
  p_description text,
  p_transaction_type text
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_current_total integer;
  v_new_total integer;
  v_current_remaining integer;
  v_new_remaining integer;
begin
  select credits_total, credits_remaining
  into v_current_total, v_current_remaining
  from public.user_credits
  where email = p_email
  for update;
```

Note it goes straight from `declare` to `select ... for update`. Everything
else in that function (the `for update` row lock, the `feature` column fix, the
`credit_transactions` insert, the `jsonb` return) is correct and **must be
preserved exactly**.

### The forward-dependency in the sibling migration

`supabase/migrations/20260721000000_initial_grant_anti_abuse.sql:74-95` inserts
a `credit_transactions` row with `transaction_type = 'initial_grant'`, and its
own comment admits the ordering problem:

```sql
  -- `feature` is NOT NULL. Non-consumption rows repeat the transaction type
  -- there, matching the existing feedback_reward / referral_reward entries.
  -- 'initial_grant' is only accepted once 20260723000000 widens the
  -- transaction_type CHECK, so apply that migration together with this one.
```

`'initial_grant'` is only added to `transaction_type_check` in
`20260723000000_fix_credit_transaction_writes.sql:21-36`. Both have already
shipped, so this is now only a hazard for a fresh environment rebuilt by
applying migrations in numeric order.

### Repo conventions you must follow

- **CRITICAL — migrations are never applied by an agent.** `CLAUDE.md` states:
  *"DB migrations: Output SQL for user to run in Supabase dashboard. NEVER
  apply directly."* You write the `.sql` file and stop. Do not run it, do not
  use any Supabase MCP tool to apply it, do not connect to a database.
- Migration filenames follow `supabase/migrations/YYYYMMDDHHMMSS_snake_case.sql`.
  Existing examples: `20260721000000_initial_grant_anti_abuse.sql`,
  `20260723000000_fix_credit_transaction_writes.sql`.
- Every migration in this repo opens with a comment block explaining *why*,
  then `begin;` … `commit;`. Model yours on
  `20260723000000_fix_credit_transaction_writes.sql:1-20`.
- JS tests for the credit layer live in
  `netlify/lib/__tests__/credit-manager.test.js` and mock `supabase.rpc`.

### A wrong claim you must NOT repeat

An earlier review asserted that `credit-manager.test.js:818-828` proves the
guard removal was accidental, because it mocks a `23514` error with the message
`'Credit amount must be positive'`. That reasoning is wrong: a plpgsql
`raise exception` produces SQLSTATE **`P0001`**, not `23514` (a CHECK
violation). That test never pinned the database guard at all — it only asserts
the JS wrapper turns *some* RPC error into `ADD_CREDITS_RPC_FAILED`. Do not
write a comment or commit message claiming the test caught this. The finding
rests entirely on the SQL diff shown above, which is sufficient on its own.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run type:check` | exit 0, no errors |
| Credit tests | `npx vitest run netlify/lib/__tests__/credit-manager.test.js` | all pass |
| Lint | `npm run lint` | exit 0 |
| Full suite | `npm run test` | exit 0 (181 files, 1774 passed, 2 skipped) |

The full suite takes ~12 minutes. Run it once at the end, not per step.

## Scope

**In scope:**
- `supabase/migrations/20260808000000_restore_add_credits_guards.sql` (create)
- `netlify/lib/__tests__/credit-manager.test.js` (add tests only)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):
- `supabase/migrations/20260723000000_fix_credit_transaction_writes.sql` and
  `20260721000000_initial_grant_anti_abuse.sql` — **already applied in
  production**. Editing a shipped migration makes the file history lie about
  what the database actually ran. Fix forward with a new migration instead.
- `netlify/lib/credit-manager.js` — the JS `addCredits` wrapper is correct as
  written; this defect is entirely in the SQL.
- `consume_user_credits`, `grant_initial_credits`, `initialize_user_credits` —
  audited and confirmed to have their guards and `FOR UPDATE` locks intact.
- Any change to the `credit_transactions` insert or the `jsonb` return shape of
  `add_credits` — callers depend on both.

## Git workflow

- Branch: `advisor/017-restore-add-credits-guards`
- Conventional commits, matching `git log` style in this repo
  (e.g. `fix: repair CI test regressions`, `fix(eval): record providers in benchmark reports`).
  Suggested: `fix(credits): restore add_credits input guards`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write the forward migration

Create `supabase/migrations/20260808000000_restore_add_credits_guards.sql`.

It must do three things, in one transaction:

1. `create or replace function public.add_credits(...)` with a body **identical
   to the current one in `20260723000000`** except that the two guards from
   `20260526` are reinstated immediately after `begin`. Copy the current body
   verbatim from `20260723000000_fix_credit_transaction_writes.sql:39-101` and
   insert only the guard block — do not rewrite, reformat, or "improve"
   anything else, and keep `security definer` and
   `set search_path to 'public', 'pg_temp'`.
2. Add a non-negative floor on the balance as defense-in-depth:
   ```sql
   alter table public.user_credits
     drop constraint if exists user_credits_remaining_non_negative;
   alter table public.user_credits
     add constraint user_credits_remaining_non_negative
     check (credits_remaining >= 0);
   ```
3. Widen `transaction_type_check` to include `'initial_grant'` idempotently, so
   a fresh environment applying migrations in numeric order is not dependent on
   ordering. This is a no-op on the existing production database. Copy the
   full `array[...]` list from
   `20260723000000_fix_credit_transaction_writes.sql:25-35` so no value is lost.

Open the file with the same comment-block style as its siblings, stating that
the guards were dropped in `20260723000000` and that this migration restores
them. Include a line telling the maintainer this must be run in the Supabase
dashboard.

**Verify**: `git status --short supabase/migrations/` → shows exactly one new
untracked `.sql` file and no modified ones.

### Step 2: Sanity-check the SQL without executing it

You cannot run this against a database. Check it by reading:

- The `create or replace` signature matches the existing one **exactly**
  (`p_email character varying, p_amount integer, p_description text, p_transaction_type text`).
  A different signature creates a *second overloaded function* instead of
  replacing the first, which would leave the unguarded version live.
- The function still ends with `return jsonb_build_object('success', true, 'credits_added', p_amount, 'total', v_new_total, 'remaining', v_new_remaining);`
- Every `$function$` / `$$` delimiter is balanced, and `begin;` has a matching `commit;`.

**Verify**: `grep -c "add_credits" supabase/migrations/20260808000000_restore_add_credits_guards.sql`
→ at least `1`. Then re-read the file top to bottom and confirm the three bullets above.

### Step 3: Add tests that pin the JS behaviour on rejection

In `netlify/lib/__tests__/credit-manager.test.js`, inside the existing
`addCredits` describe block (the one containing the test at line 818), add
tests that mock the RPC returning a plpgsql-raised error and assert the wrapper
surfaces it as a structured failure. Model them exactly on the existing test at
`credit-manager.test.js:818-829`, but use SQLSTATE `P0001` (what
`raise exception` actually produces) rather than `23514`:

- RPC rejects with `{ code: 'P0001', message: 'Credit amount must be positive' }`
  → `addCredits(...)` rejects matching `{ status: 500, code: 'ADD_CREDITS_RPC_FAILED' }`.
- RPC rejects with `{ code: 'P0001', message: 'Email is required' }` → same shape.

These are JS-layer tests. They document the contract; they cannot verify the
SQL. The real verification is Step 4.

**Verify**: `npx vitest run netlify/lib/__tests__/credit-manager.test.js` →
all pass, including your 2 new tests.

### Step 4: Write the maintainer hand-off note

Because you cannot apply the migration, the plan is not complete until the
maintainer has what they need. Add a short section at the top of the migration
file (as SQL comments) listing the exact verification queries the maintainer
should run in the Supabase SQL editor *after* applying it, e.g. calling
`add_credits` with a zero and a negative amount against a throwaway test email
and confirming both raise. Do not invent an email that could belong to a real
user — use an obviously synthetic one such as `migration-check@example.invalid`.

**Verify**: the migration file contains a comment block naming those checks.

### Step 5: Full verification

**Verify**:
- `npm run type:check` → exit 0
- `npm run lint` → exit 0
- `npm run test` → exit 0

## Test plan

- **New tests**: 2, in `netlify/lib/__tests__/credit-manager.test.js`, in the
  existing `addCredits` describe block. Cases: RPC rejects with `P0001`
  non-positive-amount; RPC rejects with `P0001` blank-email. Both assert the
  `{status: 500, code: 'ADD_CREDITS_RPC_FAILED'}` envelope.
- **Structural pattern to follow**: the existing test at
  `netlify/lib/__tests__/credit-manager.test.js:818-829`.
- **Not testable here**: the SQL guards themselves. Plan
  `020`-and-beyond territory; a real Postgres harness is tracked separately as
  its own candidate (see `plans/README.md`). Do not attempt to add one in this
  plan.
- Verification: `npx vitest run netlify/lib/__tests__/credit-manager.test.js`
  → all pass including 2 new.

## Done criteria

ALL must hold:

- [ ] `supabase/migrations/20260808000000_restore_add_credits_guards.sql` exists
- [ ] `grep -c "Credit amount must be positive" supabase/migrations/20260808000000_restore_add_credits_guards.sql` → ≥ 1
- [ ] `grep -c "Email is required" supabase/migrations/20260808000000_restore_add_credits_guards.sql` → ≥ 1
- [ ] `grep -c "user_credits_remaining_non_negative" supabase/migrations/20260808000000_restore_add_credits_guards.sql` → ≥ 1
- [ ] `grep -c "initial_grant" supabase/migrations/20260808000000_restore_add_credits_guards.sql` → ≥ 1
- [ ] `git diff --name-only d2fba38..HEAD -- supabase/migrations/20260721000000_initial_grant_anti_abuse.sql supabase/migrations/20260723000000_fix_credit_transaction_writes.sql` → **empty** (shipped migrations untouched)
- [ ] `npm run type:check` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run test` exits 0; 2 new `addCredits` tests exist and pass
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The current `add_credits` body in `20260723000000_fix_credit_transaction_writes.sql`
  does not match the excerpt in "Current state" — someone has already fixed
  this, or the file has drifted.
- A newer migration than `20260723000000` already redefines `add_credits`. In
  that case the *latest* definition is the one to copy from, and this plan's
  excerpts are stale.
- Adding the `credits_remaining >= 0` CHECK looks like it could fail on
  existing data (i.e. you find any code path that intentionally drives a
  balance negative). Report rather than dropping the constraint from the plan.
- You are tempted to run the migration, connect to Supabase, or use a Supabase
  MCP tool. That is explicitly forbidden — stop and hand the file to the maintainer.
- `npm run test` fails on files unrelated to your change.

## Maintenance notes

- **Deploy-order gate (maintainer action, not executor action)**: this
  migration must be run manually in the Supabase dashboard. The application
  code is unchanged and is safe to deploy before or after.
- The `credits_remaining >= 0` CHECK will now surface as a `23514` error at
  runtime if any future code tries to drive a balance negative. That is the
  intended behaviour, but it means a buggy refund path will fail loudly rather
  than silently corrupting a balance — reviewers should expect that.
- **What a reviewer should scrutinise**: that the `create or replace` signature
  is byte-identical to the existing one (a mismatch silently creates an
  overload and leaves the unguarded function callable), and that nothing else
  in the function body changed.
- **Deferred out of this plan**: a real Postgres-backed test harness that
  executes `supabase/migrations/*.sql` and calls the RPCs directly. That is the
  only thing that would have caught this defect automatically, and it is
  recorded as a separate candidate in `plans/README.md`. It was left out here
  to keep this fix small and shippable.
