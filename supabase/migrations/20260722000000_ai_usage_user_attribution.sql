-- Add pseudonymous user attribution to internal AI usage telemetry.
-- Created: 2026-07-22
-- Note: Run this in the Supabase dashboard SQL editor.

alter table public.ai_usage_events
  add column if not exists user_ref uuid null,
  add column if not exists jd_fingerprint text null;

comment on column public.ai_usage_events.user_ref is
  'Supabase auth user id (pseudonymous). Nullable: guest/unattributed events.';

comment on column public.ai_usage_events.jd_fingerprint is
  'Truncated one-way SHA-256 of the job description. Never reversible to content.';

create index if not exists ai_usage_events_user_feature_idx
  on public.ai_usage_events (user_ref, feature_name, created_at)
  where user_ref is not null;

-- Repeat re-targeting rate (ADR section 9): of users with at least one
-- successful optimize event, the share with at least two distinct
-- jd_fingerprints in the 14 days after their first optimize event.
--
-- with optimizers as (
--   select user_ref, jd_fingerprint, created_at
--   from public.ai_usage_events
--   where feature_name in ('optimize_resume', 'optimize_stream')
--     and success
--     and user_ref is not null
--     and jd_fingerprint is not null
-- ),
-- firsts as (
--   select user_ref, min(created_at) as first_at
--   from optimizers
--   group by user_ref
-- )
-- select
--   count(*) filter (where retargeted) as retargeting_users,
--   count(*) as measured_users,
--   round(
--     100.0 * count(*) filter (where retargeted) / greatest(count(*), 1),
--     1
--   ) as pct
-- from (
--   select
--     f.user_ref,
--     (
--       select count(distinct o.jd_fingerprint)
--       from optimizers o
--       where o.user_ref = f.user_ref
--         and o.created_at <= f.first_at + interval '14 days'
--     ) >= 2 as retargeted
--   from firsts f
--   where f.first_at <= now() - interval '14 days'
-- ) t;
