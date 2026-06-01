-- Create the production feedback reporting system.
-- This is separate from the disabled legacy public.feedback table and
-- public.add_feedback_credits RPC.
--
-- Security notes:
-- - The atomic reward function is callable only by service_role.
-- - The +5 reward uses the existing user_credits balance and credit_transactions
--   ledger. No second credit balance source is created.
-- - The previous feedback_credits_earned <= 3 constraints belonged to the
--   legacy +1/max-3 feedback RPC flow, so this migration replaces that legacy
--   cap with a nonnegative accounting constraint.

begin;

create type public.feedback_report_type as enum (
  'bug',
  'resume_quality',
  'confusing_ux',
  'feature_request',
  'pricing_credits',
  'other'
);

create type public.feedback_report_status as enum (
  'new',
  'reviewing',
  'resolved',
  'closed'
);

create type public.feedback_report_priority as enum (
  'low',
  'normal',
  'high',
  'urgent'
);

create type public.feedback_reward_status as enum (
  'awarded',
  'not_eligible',
  'duplicate',
  'already_awarded'
);

create table public.feedback_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email varchar(255) not null,
  type public.feedback_report_type not null,
  message text not null,
  rating integer check (rating between 1 and 5),
  page_path text not null default '/',
  user_agent text not null default '',
  viewport text not null default '',
  status public.feedback_report_status not null default 'new',
  priority public.feedback_report_priority not null default 'normal',
  reward_status public.feedback_reward_status not null default 'not_eligible',
  credits_awarded integer not null default 0 check (credits_awarded in (0, 5)),
  message_hash text not null,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feedback_reports_message_meaningful check (char_length(btrim(message)) >= 30),
  constraint feedback_reports_page_path_safe check (char_length(page_path) <= 500),
  constraint feedback_reports_user_agent_safe check (char_length(user_agent) <= 1000),
  constraint feedback_reports_viewport_safe check (char_length(viewport) <= 200),
  constraint feedback_reports_message_hash_format check (message_hash ~ '^[a-f0-9]{64}$')
);

create unique index feedback_reports_user_message_hash_key
  on public.feedback_reports (user_id, message_hash);

create unique index feedback_reports_one_awarded_reward_per_user
  on public.feedback_reports (user_id)
  where reward_status = 'awarded';

create index feedback_reports_created_at_idx
  on public.feedback_reports (created_at desc);

create index feedback_reports_status_priority_idx
  on public.feedback_reports (status, priority, created_at desc);

create index feedback_reports_user_created_idx
  on public.feedback_reports (user_id, created_at desc);

alter table public.feedback_reports enable row level security;

create policy feedback_reports_insert_own
  on public.feedback_reports
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and user_email = (select auth.jwt() ->> 'email')
    and status = 'new'
    and priority = 'normal'
    and reward_status = 'not_eligible'
    and credits_awarded = 0
    and admin_notes is null
  );

create policy feedback_reports_admin_select
  on public.feedback_reports
  for select
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy feedback_reports_admin_update
  on public.feedback_reports
  for update
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

revoke all on public.feedback_reports from public, anon, authenticated;
grant insert, select, update on public.feedback_reports to authenticated;
grant select, insert, update, delete on public.feedback_reports to service_role;

alter table public.user_credits
  drop constraint if exists check_feedback_credits_max;

alter table public.user_credits
  drop constraint if exists user_credits_feedback_credits_earned_check;

alter table public.user_credits
  add constraint user_credits_feedback_credits_earned_nonnegative
  check (feedback_credits_earned >= 0);

create or replace function public.submit_feedback_report(
  p_user_id uuid,
  p_user_email varchar,
  p_type public.feedback_report_type,
  p_message text,
  p_rating integer,
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
  text
) to service_role;

create or replace function public.update_feedback_reports_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists feedback_reports_updated_at on public.feedback_reports;
create trigger feedback_reports_updated_at
  before update on public.feedback_reports
  for each row
  execute function public.update_feedback_reports_updated_at();

comment on table public.feedback_reports is 'Production feedback and bug reports. Does not store resume or job description content.';
comment on function public.submit_feedback_report is 'Service-role-only atomic feedback insert and first eligible +5 credit reward.';
comment on column public.user_credits.feedback_credits_earned is 'Credits earned from the production feedback reward system. Legacy max-3 feedback semantics were removed.';

commit;
