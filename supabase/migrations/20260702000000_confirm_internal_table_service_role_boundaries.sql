-- Confirm service-role-only boundaries for internal metadata tables.
-- Created: 2026-07-02
-- Note: Run this in the Supabase dashboard SQL editor.

begin;

-- These tables intentionally have RLS enabled with no browser-role policies.
-- The app writes/reads them only through Netlify Functions using
-- SUPABASE_SERVICE_ROLE_KEY. Do not add anon/authenticated policies unless a
-- future feature introduces a reviewed direct client Data API path.
alter table public.ai_usage_events enable row level security;
alter table public.strategic_reality_checks enable row level security;

drop policy if exists "ai_usage_events_insert_own" on public.ai_usage_events;
drop policy if exists "ai_usage_events_select_own" on public.ai_usage_events;
drop policy if exists "ai_usage_events_admin_select" on public.ai_usage_events;
drop policy if exists "strategic_reality_checks_select_own_user_id" on public.strategic_reality_checks;
drop policy if exists "strategic_reality_checks_delete_own_user_id" on public.strategic_reality_checks;
drop policy if exists "strategic_reality_checks_insert_own_user_id" on public.strategic_reality_checks;

-- Revoke inherited/default broad table privileges, then grant only the
-- privileges required by current server-side code paths.
revoke all on public.ai_usage_events from public, anon, authenticated, service_role;
grant insert on public.ai_usage_events to service_role;

revoke all on public.strategic_reality_checks from public, anon, authenticated, service_role;
grant insert, select, delete on public.strategic_reality_checks to service_role;

comment on table public.ai_usage_events
  is 'Internal AI usage telemetry written only by Netlify Functions with SUPABASE_SERVICE_ROLE_KEY. RLS has no anon/authenticated policies by design; do not expose raw telemetry through browser Data API grants.';

comment on table public.strategic_reality_checks
  is 'Privacy-safe Strategic Reality Check summaries. Written/exported/deleted only by Netlify Functions with SUPABASE_SERVICE_ROLE_KEY. RLS has no anon/authenticated policies by design; browser access goes through user-data-api.';

commit;
