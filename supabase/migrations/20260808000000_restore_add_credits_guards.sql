-- Restore the input guards `add_credits` lost, and make credit writes
-- self-valid regardless of migration application order.
-- Created: 2026-08-08
-- Note: Run this in the Supabase dashboard SQL editor.
--
-- 1. `20260723000000_fix_credit_transaction_writes.sql` rewrote `add_credits`
--    from an older copy to fix the missing `feature` column, but that copy
--    silently dropped the two input-validation guards present in the prior
--    version (`20260526_harden_credit_rpcs_and_grants.sql`): a blank-email
--    check and a `p_amount <= 0` check. Since 2026-07-23, `add_credits` has
--    accepted `p_amount = 0` (a meaningless audit row) and negative amounts
--    (an unbounded, unaudited subtraction from `credits_remaining` that
--    bypasses `consume_user_credits`'s insufficient-funds check). No caller
--    passes a request-controlled amount today, so this is a latent
--    ledger-integrity hole, not a live exploit. This migration restores both
--    guards, verbatim, from the pre-2026-07-23 function body.
--
-- 2. Adds a `credits_remaining >= 0` CHECK constraint on `user_credits` as
--    defense-in-depth, so any future code path that tries to drive a
--    balance negative fails loudly (23514) instead of corrupting the ledger.
--
-- 3. Re-widens `transaction_type_check` to include 'initial_grant' (already
--    done by 20260723000000 on the live database — this is a no-op there).
--    `20260721000000_initial_grant_anti_abuse.sql` inserts a
--    'initial_grant' transaction_type but only becomes legal once
--    20260723000000 runs; doing it here too means a fresh environment that
--    applies migrations in numeric order isn't dependent on that ordering.
--
-- Both `20260721000000_initial_grant_anti_abuse.sql` and
-- `20260723000000_fix_credit_transaction_writes.sql` are already applied in
-- production and are intentionally left unmodified; this migration fixes
-- forward instead of editing shipped history.
--
-- PRE-APPLY CHECK (run this first, before applying the migration below):
--
--   select count(*) from public.user_credits where credits_remaining < 0;
--
-- This MUST return 0. The new `credits_remaining >= 0` CHECK constraint
-- will fail to apply if any existing row already violates it. If this
-- returns non-zero, STOP and reconcile those rows first (figure out why
-- they went negative and correct the balance) — do not drop the constraint
-- from this migration to work around it.
--
-- Post-apply verification (run in the Supabase SQL editor against a
-- synthetic email — never a real user's):
--
--   -- 1. Seed a throwaway row (skip if one already exists):
--   insert into public.user_credits (email, credits_total, credits_remaining)
--   values ('migration-check@example.invalid', 0, 0)
--   on conflict (email) do nothing;
--
--   -- 2. Zero amount must raise "Credit amount must be positive":
--   select public.add_credits('migration-check@example.invalid', 0, 'test', 'refund');
--
--   -- 3. Negative amount must raise "Credit amount must be positive":
--   select public.add_credits('migration-check@example.invalid', -5, 'test', 'refund');
--
--   -- 4. Blank email must raise "Email is required":
--   select public.add_credits('', 5, 'test', 'refund');
--
--   -- 5. Clean up the throwaway row:
--   delete from public.user_credits where email = 'migration-check@example.invalid';
--
-- All three calls in steps 2-4 are expected to raise an exception (P0001) and
-- must NOT modify any row.

begin;

-- Reinstate the two guards dropped in 20260723000000. Everything else in
-- this function body (the `feature` column fix, the `for update` row lock,
-- the credit_transactions insert, the jsonb return shape) is copied
-- verbatim from the current live definition and must not change.
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

  if not found then
    raise exception 'User credits record not found for email: %', p_email;
  end if;

  v_new_total := v_current_total + p_amount;
  v_new_remaining := v_current_remaining + p_amount;

  update public.user_credits
  set
    credits_total = v_new_total,
    credits_remaining = v_new_remaining,
    updated_at = now()
  where email = p_email;

  insert into public.credit_transactions (
    email,
    feature,
    transaction_type,
    credits_before,
    credits_after,
    amount,
    metadata
  ) values (
    p_email,
    p_transaction_type,
    p_transaction_type,
    v_current_remaining,
    v_new_remaining,
    p_amount,
    jsonb_build_object('description', p_description)
  );

  return jsonb_build_object(
    'success', true,
    'credits_added', p_amount,
    'total', v_new_total,
    'remaining', v_new_remaining
  );
end;
$function$;

-- Defense-in-depth: a non-negative floor on the balance itself, independent
-- of which RPC (or future code path) touches it.
alter table public.user_credits
  drop constraint if exists user_credits_remaining_non_negative;
alter table public.user_credits
  add constraint user_credits_remaining_non_negative
  check (credits_remaining >= 0);

-- Idempotent re-application of the transaction_type widening, so a fresh
-- environment applying migrations in numeric order does not depend on
-- 20260723000000 having already run before 20260721000000's 'initial_grant'
-- insert becomes legal.
alter table public.credit_transactions
  drop constraint if exists transaction_type_check;

alter table public.credit_transactions
  add constraint transaction_type_check check (
    transaction_type = any (array[
      'consumption'::text,
      'referral_reward'::text,
      'feedback_reward'::text,
      'monthly_reset'::text,
      'reset'::text,
      'refund'::text,
      'celebration_bonus'::text,
      'initial_grant'::text
    ])
  );

commit;
