-- Migration: add job_applications table for pipeline tracking
-- Created: 2026-05-22
-- Note: Run this in the Supabase dashboard SQL editor.

-- Ensure update_updated_at_column function exists first (shared by multiple tables)
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql
set search_path = public;

-- Job applications table
create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_name text,
  job_title text,
  job_description text not null,
  job_url text,
  location text,
  employment_type text,
  seniority text,
  sector text,
  match_score integer check (match_score is null or (match_score >= 0 and match_score <= 100)),
  status text not null default 'saved' check (status in ('saved','applied','interview','offer','rejected','withdrawn')),
  resume_export_file_path text,
  resume_export_file_name text,
  notes text,
  metadata jsonb not null default '{}',
  applied_at timestamptz,
  interview_at timestamptz,
  outcome_at timestamptz,
  outcome_source text not null default 'user_confirmed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on public.job_applications from anon;
revoke all on public.job_applications from authenticated;
-- Authenticated browser clients need CRUD only; do not grant REFERENCES, TRIGGER, or TRUNCATE.
grant select, insert, update, delete on public.job_applications to authenticated;

-- Indexes for common query patterns
create index if not exists idx_job_applications_user_id on public.job_applications(user_id);
create index if not exists idx_job_applications_user_status on public.job_applications(user_id, status);
create index if not exists idx_job_applications_user_updated_at_desc on public.job_applications(user_id, updated_at desc);

-- Safe trigger creation using DO block (Postgres does not support "create trigger if not exists")
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_job_applications_updated_at'
      and tgrelid = 'public.job_applications'::regclass
  ) then
    create trigger trg_job_applications_updated_at
      before update on public.job_applications
      for each row
      execute function public.update_updated_at_column();
  end if;
end;
$$;

-- Enable RLS
alter table public.job_applications enable row level security;

-- Policies: use "to authenticated" and wrap auth.uid() as (select auth.uid()) for RLS performance
drop policy if exists "Users can select own job applications" on public.job_applications;
create policy "Users can select own job applications"
  on public.job_applications for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own job applications" on public.job_applications;
create policy "Users can insert own job applications"
  on public.job_applications for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own job applications" on public.job_applications;
create policy "Users can update own job applications"
  on public.job_applications for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own job applications" on public.job_applications;
create policy "Users can delete own job applications"
  on public.job_applications for delete
  to authenticated
  using ((select auth.uid()) = user_id);
