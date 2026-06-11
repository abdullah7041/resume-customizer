-- Migration: create strategic_reality_checks summary table
-- Created: 2026-06-07
-- Note: Run this in the Supabase dashboard SQL editor.

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

revoke all on public.strategic_reality_checks from anon;
revoke all on public.strategic_reality_checks from authenticated;
grant insert, select, delete on public.strategic_reality_checks to service_role;

create index if not exists idx_strategic_reality_checks_user_created_at
  on public.strategic_reality_checks(user_id, created_at desc);

create index if not exists idx_strategic_reality_checks_risk_tier
  on public.strategic_reality_checks(risk_tier);

alter table public.strategic_reality_checks enable row level security;

drop policy if exists "strategic_reality_checks_select_own_user_id" on public.strategic_reality_checks;
drop policy if exists "strategic_reality_checks_delete_own_user_id" on public.strategic_reality_checks;

comment on table public.strategic_reality_checks
  is 'Privacy-safe Strategic Reality Check summaries. Stores structured tiers, recommendations, risk type enums, HMAC input hashes, counts, and timestamps only. Does not store resume text, job text, prompts, raw AI responses, model reasoning, or evidence snippets.';
