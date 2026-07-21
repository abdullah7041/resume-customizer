-- Note: Run this in the Supabase dashboard SQL editor.

begin;

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

  insert into public.user_credits (user_id, email, credits_remaining, credits_total, signup_metadata)
  values (new.id, new.email, 0, 0, jsonb_build_object('pending_initial_grant', true))
  on conflict (email) do update
  set user_id = excluded.user_id;

  return new;
end;
$$;

create or replace function public.grant_initial_credits(
  p_email text,
  p_amount integer,
  p_ip_address text default null
) returns table (granted boolean, credits_remaining integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current_remaining integer;
  v_signup_metadata jsonb;
begin
  if p_amount is null or p_amount < 0 or p_amount > 20 then
    raise exception 'Initial credit amount must be between 0 and 20';
  end if;

  select user_credits.credits_remaining, user_credits.signup_metadata
  into v_current_remaining, v_signup_metadata
  from public.user_credits
  where email = p_email
  for update;

  if not found then
    raise exception 'User credits record not found for email: %', p_email;
  end if;

  if v_signup_metadata->>'pending_initial_grant' is distinct from 'true' then
    granted := false;
    credits_remaining := v_current_remaining;
    return next;
    return;
  end if;

  update public.user_credits
  set
    credits_remaining = p_amount,
    credits_total = p_amount,
    signup_metadata = coalesce(v_signup_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'pending_initial_grant', false,
        'initial_grant_at', now()
      )
      || case
        when p_ip_address is null then '{}'::jsonb
        else jsonb_build_object('ip_address', p_ip_address)
      end,
    updated_at = now()
  where email = p_email;

  insert into public.credit_transactions (
    email,
    transaction_type,
    credits_before,
    credits_after,
    amount,
    metadata
  ) values (
    p_email,
    'initial_grant',
    v_current_remaining,
    p_amount,
    p_amount,
    jsonb_build_object('description', 'Initial signup credit grant')
  );

  granted := true;
  credits_remaining := p_amount;
  return next;
end;
$$;

revoke execute on function public.grant_initial_credits(text, integer, text) from public, anon, authenticated;
grant execute on function public.grant_initial_credits(text, integer, text) to service_role;

commit;
