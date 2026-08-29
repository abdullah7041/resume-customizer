-- Migration: Job Feed — BYO-companies job discovery
-- Created: 2026-08-29
-- Note: Run this in the Supabase dashboard SQL editor. NEVER applied automatically.
--
-- Four tables plus two columns on user_profiles:
--   ats_companies          shared registry, one row per company board, service-role writes
--   user_tracked_companies who follows what (RLS own-rows)
--   job_postings           crawl output, public job data, authenticated read
--   user_job_feed_state    dismiss/save marks (RLS own-rows)
--
-- Cost note: load scales with DISTINCT companies, not users — one company is
-- crawled once however many people track it.

-- ---------------------------------------------------------------------------
-- user_profiles: the profile home for search intent.
--
-- search_intent previously lived on public.resumes, which is deprecated and holds
-- zero rows — so every save updated 0 rows and every read returned null.
-- user_profiles is the live table (keyed id = auth.users.id, unique email).
-- ---------------------------------------------------------------------------
alter table public.user_profiles add column if not exists search_intent jsonb;
alter table public.user_profiles add column if not exists last_feed_seen_at timestamptz;

comment on column public.user_profiles.search_intent is
  'Job-search intent (targetRoles, seniority, locations). Moved here from the deprecated public.resumes table.';
comment on column public.user_profiles.last_feed_seen_at is
  'Last time the user opened the Job Feed. Half of the new-posting predicate; the other half is user_tracked_companies.created_at.';

-- ---------------------------------------------------------------------------
-- ats_companies
--
-- source is a text check rather than a Postgres enum on purpose: adding a
-- provider must never require a migration.
-- ---------------------------------------------------------------------------
create table if not exists public.ats_companies (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('greenhouse','ashby','workable','lever','pinpoint','workday','jsonld')),
  -- Provider handle. Workday packs tenant:host:site; jsonld uses the careers URL.
  token text not null,
  display_name text not null,
  careers_url text,
  last_fetched_at timestamptz,
  -- Set only by a crawl that explicitly succeeded, so a failure never looks like an empty board.
  last_status text not null default 'pending' check (last_status in ('pending','ok','failed')),
  last_error text,
  last_job_count integer not null default 0,
  -- Short lease taken by the cron before handing off. A lease is not a completion:
  -- last_fetched_at is stamped by the crawler after the upsert lands, so a background
  -- run that dies leaves its companies eligible again once the lease expires.
  crawl_lease_until timestamptz,
  created_at timestamptz not null default now(),
  unique (source, token)
);

revoke all on public.ats_companies from anon;
revoke all on public.ats_companies from authenticated;
grant select on public.ats_companies to authenticated;

create index if not exists idx_ats_companies_staleness
  on public.ats_companies(last_fetched_at nulls first);

alter table public.ats_companies enable row level security;

drop policy if exists "Authenticated users can read companies" on public.ats_companies;
create policy "Authenticated users can read companies"
  on public.ats_companies for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- user_tracked_companies
-- ---------------------------------------------------------------------------
create table if not exists public.user_tracked_companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.ats_companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, company_id)
);

revoke all on public.user_tracked_companies from anon;
revoke all on public.user_tracked_companies from authenticated;
grant select, insert, delete on public.user_tracked_companies to authenticated;

create index if not exists idx_user_tracked_companies_user on public.user_tracked_companies(user_id);
create index if not exists idx_user_tracked_companies_company on public.user_tracked_companies(company_id);

alter table public.user_tracked_companies enable row level security;

drop policy if exists "Users select own tracked companies" on public.user_tracked_companies;
create policy "Users select own tracked companies"
  on public.user_tracked_companies for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users insert own tracked companies" on public.user_tracked_companies;
create policy "Users insert own tracked companies"
  on public.user_tracked_companies for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete own tracked companies" on public.user_tracked_companies;
create policy "Users delete own tracked companies"
  on public.user_tracked_companies for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- job_postings
--
-- Public job data, no user content — deliberately outside the GDPR export set.
-- The feed list query must select explicit columns and NEVER description:
-- scoring reads only title and location, and shipping JD text to the browser on
-- every feed open would be megabytes for nothing.
-- ---------------------------------------------------------------------------
create table if not exists public.job_postings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.ats_companies(id) on delete cascade,
  external_id text not null,
  title text not null,
  location text not null default '',
  apply_url text not null default '',
  -- Null wherever the board publishes no date (Pinpoint has none; the Workday
  -- "Posted Yesterday" string is prose, deliberately not parsed). Ordering falls
  -- back to first_seen_at.
  posted_at timestamptz,
  description text not null default '',
  -- Read-time collapse of reposted descriptions. Deliberately NOT a unique index:
  -- two companies with identical boilerplate JDs would collide on a constraint.
  description_sha256 text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (company_id, external_id)
);

revoke all on public.job_postings from anon;
revoke all on public.job_postings from authenticated;
grant select on public.job_postings to authenticated;

create index if not exists idx_job_postings_company_open
  on public.job_postings(company_id, closed_at, first_seen_at desc);
create index if not exists idx_job_postings_closed_at
  on public.job_postings(closed_at) where closed_at is not null;

alter table public.job_postings enable row level security;

drop policy if exists "Authenticated users can read postings" on public.job_postings;
create policy "Authenticated users can read postings"
  on public.job_postings for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- user_job_feed_state
--
-- UI marking only. public.job_applications remains the authoritative record of a
-- saved job; a saved row here just keeps the feed from re-offering it.
-- ---------------------------------------------------------------------------
create table if not exists public.user_job_feed_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  posting_id uuid not null references public.job_postings(id) on delete cascade,
  state text not null check (state in ('dismissed','saved')),
  acted_at timestamptz not null default now(),
  unique (user_id, posting_id)
);

revoke all on public.user_job_feed_state from anon;
revoke all on public.user_job_feed_state from authenticated;
grant select, insert, update, delete on public.user_job_feed_state to authenticated;

create index if not exists idx_user_job_feed_state_user on public.user_job_feed_state(user_id);

alter table public.user_job_feed_state enable row level security;

drop policy if exists "Users select own feed state" on public.user_job_feed_state;
create policy "Users select own feed state"
  on public.user_job_feed_state for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users insert own feed state" on public.user_job_feed_state;
create policy "Users insert own feed state"
  on public.user_job_feed_state for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users update own feed state" on public.user_job_feed_state;
create policy "Users update own feed state"
  on public.user_job_feed_state for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete own feed state" on public.user_job_feed_state;
create policy "Users delete own feed state"
  on public.user_job_feed_state for delete
  to authenticated
  using ((select auth.uid()) = user_id);
