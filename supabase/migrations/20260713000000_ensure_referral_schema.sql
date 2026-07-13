-- Ensure the referral-program schema exists (idempotent repair).
--
-- The referral API (netlify/functions/referral-api.ts + netlify/lib/referral-manager.js)
-- requires these user_credits columns. If any of them is missing in production
-- (a migration that was never run in the dashboard), every get-link/get-summary
-- call fails with Postgres 42703 (undefined column) and the Credit Usage modal
-- shows "Referral link unavailable — Referral operation failed".
--
-- Safe to re-run: every statement is IF NOT EXISTS / conditional.

begin;

alter table public.user_credits add column if not exists referral_code text;
alter table public.user_credits add column if not exists referred_by_user_id uuid;
alter table public.user_credits add column if not exists referred_by_email varchar(255);
alter table public.user_credits add column if not exists referral_completed boolean default false;
alter table public.user_credits add column if not exists referral_completed_at timestamptz;
alter table public.user_credits add column if not exists user_id uuid;

-- Backfill user_id from auth.users for rows created while the column was absent
-- (referral stats and tracking key on user_id).
update public.user_credits target
set user_id = auth_user.id
from auth.users auth_user
where target.user_id is null
  and lower(target.email::text) = lower(auth_user.email);

-- Referral codes must be unique to resolve ?ref=CODE to exactly one referrer.
-- Partial index: NULL (no code generated yet) stays unrestricted.
create unique index if not exists user_credits_referral_code_unique
  on public.user_credits(referral_code)
  where referral_code is not null;

create index if not exists idx_user_credits_referral_code
  on public.user_credits(referral_code);
create index if not exists idx_user_credits_referred_by_user_id
  on public.user_credits(referred_by_user_id);
create index if not exists idx_user_credits_user_id
  on public.user_credits(user_id);

comment on column public.user_credits.referral_code is 'Unique referral code for sharing (e.g., ABC123XY)';
comment on column public.user_credits.referred_by_user_id is 'UUID of the user who referred this user (null if not referred)';
comment on column public.user_credits.referral_completed is 'Whether the referral has been completed';
comment on column public.user_credits.referral_completed_at is 'Timestamp when the referral was marked complete';

commit;

-- Diagnostic: all six columns must be listed by this query.
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'user_credits'
  and column_name in (
    'referral_code',
    'referred_by_user_id',
    'referred_by_email',
    'referral_completed',
    'referral_completed_at',
    'user_id'
  )
order by column_name;
