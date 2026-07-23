-- Repair two long-standing defects in how credits are written.
-- Created: 2026-07-23
-- Note: Run this in the Supabase dashboard SQL editor.
--
-- 1. `credit_transactions.feature` is NOT NULL, but `add_credits` never supplied
--    it. Every call therefore failed with 23502, so no reward, refund or bonus
--    routed through the RPC was ever recorded — including the referral payouts
--    that plan 008 moved onto it.
--
-- 2. `transaction_type_check` allowed only consumption / referral_reward /
--    feedback_reward / monthly_reset, while the application also writes
--    'refund' (the optimize, optimize-stream and vision2030 fail-safes),
--    'reset' (cron-reset-credits), 'celebration_bonus' (dev tool) and
--    'initial_grant' (plan 007). Those inserts failed with 23514; refunds in
--    particular were silently dropped.
--
-- Both were verified against production by calling the RPCs directly.

begin;

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

-- Adds the missing `feature` value and takes the row lock the read-modify-write
-- always needed.
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

commit;
