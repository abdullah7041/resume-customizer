-- Repair pipeline and privacy-sensitive database boundaries after the latest
-- match/pipeline updates. This migration is intentionally forward-only and
-- idempotent for production databases that already have some objects.

begin;

-- Strategic Reality Check summaries are written only by the server-side match
-- function through the service role. Browser clients export/delete these rows
-- through user-data-api, not direct table access.
create table if not exists public.strategic_reality_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  match_score integer check (match_score is null or (match_score >= 0 and match_score <= 100)),
  language text not null default 'en' check (language in ('en', 'ar')),
  risk_tier text not null check (risk_tier in ('low', 'medium', 'high', 'critical')),
  recommendation text not null check (recommendation in (
    'optimize_now',
    'answer_clarifications_first',
    'add_evidence_first',
    'review_role_fit'
  )),
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  risk_types text[] not null default '{}',
  resume_hash text not null,
  job_hash text not null,
  summary_metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_strategic_reality_checks_user_created_at
  on public.strategic_reality_checks(user_id, created_at desc);

create index if not exists idx_strategic_reality_checks_risk_tier
  on public.strategic_reality_checks(risk_tier);

alter table public.strategic_reality_checks enable row level security;
drop policy if exists "strategic_reality_checks_select_own_user_id" on public.strategic_reality_checks;
drop policy if exists "strategic_reality_checks_delete_own_user_id" on public.strategic_reality_checks;
revoke all on public.strategic_reality_checks from public, anon, authenticated;
grant insert, select, delete on public.strategic_reality_checks to service_role;

comment on table public.strategic_reality_checks
  is 'Privacy-safe Strategic Reality Check summaries. Stores structured tiers, recommendations, risk type enums, HMAC input hashes, counts, and timestamps only. Does not store resume text, job text, prompts, raw AI responses, model reasoning, or evidence snippets.';

-- Pipeline statuses: remove the ambiguous interview state and preserve the
-- user's application timeline by mapping historical interview rows to applied.
do $$
begin
  if to_regclass('public.job_applications') is not null then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'job_applications'
        and column_name = 'interview_at'
    ) then
      update public.job_applications
      set
        status = 'applied',
        applied_at = coalesce(applied_at, interview_at, updated_at, created_at, now()),
        updated_at = now()
      where status = 'interview';
    else
      update public.job_applications
      set
        status = 'applied',
        applied_at = coalesce(applied_at, updated_at, created_at, now()),
        updated_at = now()
      where status = 'interview';
    end if;
  end if;
end;
$$;

alter table if exists public.job_applications
  drop constraint if exists job_applications_status_check;

alter table if exists public.job_applications
  add constraint job_applications_status_check
  check (status in ('saved', 'applied', 'offer', 'rejected', 'withdrawn'));

alter table if exists public.job_applications
  drop column if exists interview_at;

revoke all on public.job_applications from anon;
revoke all on public.job_applications from authenticated;
grant select, insert, update, delete on public.job_applications to authenticated;

-- Ensure the production feedback contract has structured validation answers.
alter table if exists public.feedback_reports
  add column if not exists trust_to_apply text,
  add column if not exists willingness_to_pay text;

alter table if exists public.feedback_reports
  drop constraint if exists feedback_reports_trust_to_apply_allowed,
  add constraint feedback_reports_trust_to_apply_allowed
  check (trust_to_apply is null or trust_to_apply in ('yes', 'somewhat', 'no'));

alter table if exists public.feedback_reports
  drop constraint if exists feedback_reports_willingness_to_pay_allowed,
  add constraint feedback_reports_willingness_to_pay_allowed
  check (willingness_to_pay is null or willingness_to_pay in ('yes', 'maybe', 'no'));

comment on column public.feedback_reports.trust_to_apply is
  'Optional categorical beta validation answer. Does not store resume, JD, prompt, or AI output content.';

comment on column public.feedback_reports.willingness_to_pay is
  'Optional categorical beta validation answer. Does not store resume, JD, prompt, or AI output content.';

-- Legacy account tables stay available to service-role export/delete only until
-- archived rows are handled and an explicit follow-up drop migration is approved.
do $$
begin
  if to_regclass('public.resumes') is not null then
    revoke all on public.resumes from public, anon, authenticated;
    grant select, delete on public.resumes to service_role;
  end if;

  if to_regclass('public.job_matches') is not null then
    revoke all on public.job_matches from public, anon, authenticated;
    grant select, delete on public.job_matches to service_role;
  end if;

  if to_regclass('public.feedback') is not null then
    revoke all on public.feedback from public, anon, authenticated;
    grant select, delete on public.feedback to service_role;
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.resumes') is not null then
    comment on table public.resumes
      is 'Deprecated legacy resume table retained temporarily for GDPR export/delete. Do not write new resume content here.';
  end if;

  if to_regclass('public.job_matches') is not null then
    comment on table public.job_matches
      is 'Deprecated legacy match table retained temporarily for GDPR export/delete. New match flow stores only privacy-safe Strategic Reality Check summaries.';
  end if;

  if to_regclass('public.feedback') is not null then
    comment on table public.feedback
      is 'Deprecated legacy feedback table retained temporarily for archival GDPR handling. Production feedback uses public.feedback_reports.';
  end if;
end;
$$;

commit;
