-- Backfill canonical UUID referral relationships from legacy email referrals.
--
-- The active referral code now uses user_credits.referred_by_user_id for durable
-- auth.users identity. Older rows may still have only referred_by_email populated;
-- backfill those rows so stats and completion continue to see existing referrals.

begin;

update public.user_credits referee
set referred_by_user_id = referrer.user_id
from public.user_credits referrer
where referee.referred_by_user_id is null
  and referee.referred_by_email is not null
  and referrer.user_id is not null
  and lower(referee.referred_by_email::text) = lower(referrer.email::text);

commit;
