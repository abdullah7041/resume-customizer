-- Preserve UUID ownership for referral rows created after the referral repair.
-- This is a forward migration because 20260713000000 may already be applied.

update public.user_credits target
set user_id = auth_user.id
from auth.users auth_user
where target.user_id is null
  and lower(target.email::text) = lower(auth_user.email);

create or replace function public.initialize_user_credits()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.user_profiles (id, email, is_premium)
  values (new.id, new.email, false)
  on conflict do nothing;

  insert into public.user_credits (user_id, email, credits_remaining, credits_total)
  values (new.id, new.email, 20, 20)
  on conflict (email) do update
  set user_id = excluded.user_id;

  return new;
end;
$$;
