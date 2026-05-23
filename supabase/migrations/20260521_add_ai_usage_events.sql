-- Migration: add ai_usage_events table for internal cost tracking
-- Created: 2026-05-21
-- Note: Run this in the Supabase dashboard SQL editor.

create table if not exists public.ai_usage_events (
  id bigint generated always as identity primary key,
  feature_name text not null,
  model text not null,
  provider text not null,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  reasoning_tokens integer not null default 0,
  total_tokens integer not null default 0,
  estimated_cost_usd numeric(12,6) null,
  latency_ms integer not null default 0,
  success boolean not null default true,
  error_code text null,
  created_at timestamptz not null default now()
);

-- Enable RLS but allow service-role inserts only
alter table public.ai_usage_events enable row level security;

-- Be explicit about Data API privileges. RLS blocks rows without policies, but
-- TRUNCATE and table exposure are privilege-level concerns, not row policies.
revoke all on public.ai_usage_events from anon;
revoke all on public.ai_usage_events from authenticated;
grant insert on public.ai_usage_events to service_role;

-- No policy for anon/users: inserts happen only from server-side service role.
-- If you need dashboard reads later, create a policy for authenticated users with explicit roles.
