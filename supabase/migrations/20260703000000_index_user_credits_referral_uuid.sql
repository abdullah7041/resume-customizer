-- Cover the canonical UUID referral relationship used by referral-manager.
--
-- Supabase performance advisor reports user_credits_referred_by_user_id_fkey
-- when the referencing column has no plain covering index. The email referral
-- column is legacy compatibility data; referral persistence uses auth.users IDs.

create index if not exists idx_user_credits_referred_by_user_id
  on public.user_credits(referred_by_user_id);

comment on column public.user_credits.referred_by_user_id is
  'Canonical auth.users UUID of the user who referred this account. Covered by idx_user_credits_referred_by_user_id for FK delete/update checks and referral stats.';
