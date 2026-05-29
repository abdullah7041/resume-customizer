-- Migration: harden credit RPC execution and browser-role table grants
-- Created: 2026-05-26
-- Note: Run this in the Supabase dashboard SQL editor.

begin;

create or replace function public.add_credits(
  p_email varchar,
  p_amount integer,
  p_description text,
  p_transaction_type text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
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
    transaction_type,
    credits_before,
    credits_after,
    amount,
    metadata
  ) values (
    p_email,
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
$$;

create or replace function public.add_feedback_credits(
  p_email varchar
) returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_feedback_credits_earned integer;
  v_credits_remaining integer;
  v_credits_total integer;
  v_max_feedback_credits constant integer := 3;
  v_result json;
begin
  if nullif(trim(p_email), '') is null then
    raise exception 'Email is required';
  end if;

  select
    feedback_credits_earned,
    credits_remaining,
    credits_total
  into
    v_feedback_credits_earned,
    v_credits_remaining,
    v_credits_total
  from public.user_credits
  where email = p_email
  for update;

  if not found then
    raise exception 'User credits record not found for email: %', p_email;
  end if;

  if v_feedback_credits_earned >= v_max_feedback_credits then
    v_result := jsonb_build_object(
      'success', false,
      'error', 'max_feedback_credits_reached',
      'message', 'Maximum feedback credits already earned',
      'credits_awarded', 0,
      'feedback_credits_earned', v_feedback_credits_earned,
      'credits_remaining', v_credits_remaining
    );
    return v_result;
  end if;

  v_credits_remaining := v_credits_remaining + 1;
  v_feedback_credits_earned := v_feedback_credits_earned + 1;

  update public.user_credits
  set
    credits_remaining = v_credits_remaining,
    feedback_credits_earned = v_feedback_credits_earned,
    updated_at = now()
  where email = p_email;

  insert into public.credit_transactions (
    email,
    feature,
    amount,
    credits_before,
    credits_after,
    transaction_type,
    metadata
  ) values (
    p_email,
    'feedback_reward',
    1,
    v_credits_remaining - 1,
    v_credits_remaining,
    'feedback_reward',
    jsonb_build_object(
      'timestamp', now()::text,
      'feedback_credits_earned', v_feedback_credits_earned
    )
  );

  v_result := jsonb_build_object(
    'success', true,
    'credits_awarded', 1,
    'feedback_credits_earned', v_feedback_credits_earned,
    'credits_remaining', v_credits_remaining
  );

  return v_result;
end;
$$;

create or replace function public.consume_user_credits(
  p_email varchar,
  p_amount integer
) returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current_credits integer;
  v_new_credits integer;
begin
  if nullif(trim(p_email), '') is null then
    raise exception 'Email is required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Credit amount must be positive';
  end if;

  select credits_remaining into v_current_credits
  from public.user_credits
  where email = p_email
  for update;

  if not found then
    raise exception 'User credits record not found';
  end if;

  if v_current_credits < p_amount then
    raise exception 'Insufficient credits: % available, % required', v_current_credits, p_amount;
  end if;

  v_new_credits := v_current_credits - p_amount;

  update public.user_credits
  set
    credits_remaining = v_new_credits,
    updated_at = now()
  where email = p_email;

  return v_new_credits;
end;
$$;

revoke execute on function public.add_credits(varchar, integer, text, text) from public, anon, authenticated;
revoke execute on function public.add_feedback_credits(varchar) from public, anon, authenticated;
revoke execute on function public.consume_user_credits(varchar, integer) from public, anon, authenticated;

grant execute on function public.add_credits(varchar, integer, text, text) to service_role;
grant execute on function public.add_feedback_credits(varchar) to service_role;
grant execute on function public.consume_user_credits(varchar, integer) to service_role;

revoke all on public.user_credits from anon, authenticated;
grant select on public.user_credits to authenticated;
grant select, insert, update, delete on public.user_credits to service_role;

revoke all on public.credit_transactions from anon, authenticated;
grant select on public.credit_transactions to authenticated;
grant select, insert, update, delete on public.credit_transactions to service_role;

revoke all on public.ai_usage_events from anon, authenticated;
grant insert on public.ai_usage_events to service_role;

revoke all on public.job_applications from anon, authenticated;
grant select, insert, update, delete on public.job_applications to authenticated;

commit;
