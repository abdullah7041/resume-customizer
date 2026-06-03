-- Persist beta feedback validation answers as structured categorical fields.
-- This replaces the temporary message-footer fallback without storing resume,
-- job description, prompt, or AI output content.

begin;

alter table public.feedback_reports
  add column if not exists trust_to_apply text,
  add column if not exists willingness_to_pay text;

alter table public.feedback_reports
  drop constraint if exists feedback_reports_trust_to_apply_allowed,
  add constraint feedback_reports_trust_to_apply_allowed
  check (trust_to_apply is null or trust_to_apply in ('yes', 'somewhat', 'no'));

alter table public.feedback_reports
  drop constraint if exists feedback_reports_willingness_to_pay_allowed,
  add constraint feedback_reports_willingness_to_pay_allowed
  check (willingness_to_pay is null or willingness_to_pay in ('yes', 'maybe', 'no'));

comment on column public.feedback_reports.trust_to_apply is
  'Optional categorical beta validation answer. Does not store resume, JD, prompt, or AI output content.';

comment on column public.feedback_reports.willingness_to_pay is
  'Optional categorical beta validation answer. Does not store resume, JD, prompt, or AI output content.';

create or replace function public.submit_feedback_report(
  p_user_id uuid,
  p_user_email varchar,
  p_type public.feedback_report_type,
  p_message text,
  p_rating integer,
  p_trust_to_apply text,
  p_willingness_to_pay text,
  p_page_path text,
  p_user_agent text,
  p_viewport text,
  p_message_hash text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_feedback_id uuid;
  v_existing_reward_id uuid;
  v_credits_before integer;
  v_credits_after integer;
  v_reward_status public.feedback_reward_status := 'not_eligible';
  v_credits_awarded integer := 0;
begin
  if p_user_id is null then
    raise exception 'User id is required';
  end if;

  if nullif(btrim(p_user_email), '') is null then
    raise exception 'User email is required';
  end if;

  if char_length(btrim(coalesce(p_message, ''))) < 30 then
    raise exception 'Feedback message must be at least 30 characters';
  end if;

  if p_trust_to_apply is not null and p_trust_to_apply not in ('yes', 'somewhat', 'no') then
    raise exception 'Invalid trust_to_apply feedback validation answer';
  end if;

  if p_willingness_to_pay is not null and p_willingness_to_pay not in ('yes', 'maybe', 'no') then
    raise exception 'Invalid willingness_to_pay feedback validation answer';
  end if;

  if p_message_hash is null or p_message_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'A valid feedback message hash is required';
  end if;

  select id
  into v_existing_reward_id
  from public.feedback_reports
  where user_id = p_user_id
    and reward_status = 'awarded'
  limit 1;

  if v_existing_reward_id is null then
    select credits_remaining
    into v_credits_before
    from public.user_credits
    where email = p_user_email
    for update;

    if not found then
      raise exception 'User credits record not found for email: %', p_user_email;
    end if;

    v_reward_status := 'awarded';
    v_credits_awarded := 5;
    v_credits_after := v_credits_before + v_credits_awarded;
  else
    v_reward_status := 'already_awarded';
    v_credits_awarded := 0;
  end if;

  insert into public.feedback_reports (
    user_id,
    user_email,
    type,
    message,
    rating,
    trust_to_apply,
    willingness_to_pay,
    page_path,
    user_agent,
    viewport,
    reward_status,
    credits_awarded,
    message_hash
  ) values (
    p_user_id,
    p_user_email,
    p_type,
    btrim(p_message),
    p_rating,
    p_trust_to_apply,
    p_willingness_to_pay,
    left(coalesce(nullif(btrim(p_page_path), ''), '/'), 500),
    left(coalesce(p_user_agent, ''), 1000),
    left(coalesce(p_viewport, ''), 200),
    v_reward_status,
    v_credits_awarded,
    p_message_hash
  )
  returning id into v_feedback_id;

  if v_credits_awarded > 0 then
    update public.user_credits
    set
      credits_remaining = v_credits_after,
      feedback_credits_earned = coalesce(feedback_credits_earned, 0) + v_credits_awarded,
      updated_at = now()
    where email = p_user_email;

    insert into public.credit_transactions (
      email,
      feature,
      amount,
      credits_before,
      credits_after,
      transaction_type,
      metadata
    ) values (
      p_user_email,
      'feedback_reward',
      v_credits_awarded,
      v_credits_before,
      v_credits_after,
      'feedback_reward',
      jsonb_build_object(
        'feedback_report_id', v_feedback_id,
        'feedback_type', p_type,
        'reward_policy', 'first_eligible_feedback_v1'
      )
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'id', v_feedback_id,
    'reward_status', v_reward_status,
    'credits_awarded', v_credits_awarded,
    'credits_remaining', coalesce(v_credits_after, v_credits_before)
  );
exception
  when unique_violation then
    return jsonb_build_object(
      'success', false,
      'error', 'duplicate_feedback',
      'reward_status', 'duplicate',
      'credits_awarded', 0
    );
end;
$$;

revoke execute on function public.submit_feedback_report(
  uuid,
  varchar,
  public.feedback_report_type,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.submit_feedback_report(
  uuid,
  varchar,
  public.feedback_report_type,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  text
) to service_role;

revoke execute on function public.submit_feedback_report(
  uuid,
  varchar,
  public.feedback_report_type,
  text,
  integer,
  text,
  text,
  text,
  text
) from public, anon, authenticated, service_role;

drop function if exists public.submit_feedback_report(
  uuid,
  varchar,
  public.feedback_report_type,
  text,
  integer,
  text,
  text,
  text,
  text
);

comment on function public.submit_feedback_report(
  uuid,
  varchar,
  public.feedback_report_type,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  text
) is 'Service-role-only atomic feedback insert with structured validation answers and first eligible +5 credit reward.';

commit;
