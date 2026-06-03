-- Harden exposed SECURITY DEFINER functions after feedback rollout verification.
--
-- Live verification showed anon/authenticated still had EXECUTE on older credit
-- and security helper RPCs. The app does not call these RPCs from the browser:
-- active credit consumption/referral rewards run through Netlify functions with
-- SUPABASE_SERVICE_ROLE_KEY, while feedback rewards use submit_feedback_report().
--
-- This migration is intentionally forward-only. Do not rewrite historical
-- migrations that may already be present in Supabase migration history.

begin;

do $$
declare
  fn record;
begin
  for fn in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as identity_arguments
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'add_credits',
        'add_feedback_credits',
        'consume_user_credits',
        'initialize_user_credits',
        'rls_auto_enable'
      )
  loop
    execute format(
      'revoke execute on function %I.%I(%s) from public, anon, authenticated',
      fn.schema_name,
      fn.function_name,
      fn.identity_arguments
    );

    execute format(
      'alter function %I.%I(%s) set search_path = public, pg_temp',
      fn.schema_name,
      fn.function_name,
      fn.identity_arguments
    );
  end loop;
end
$$;

-- Keep only the active server-side credit RPCs callable by service_role.
-- These are used by Netlify Functions through netlify/lib/credit-manager.js and
-- netlify/lib/referral-manager.js. No browser client should execute them.
do $$
begin
  if to_regprocedure('public.add_credits(character varying, integer, text, text)') is not null then
    grant execute on function public.add_credits(varchar, integer, text, text) to service_role;
  end if;

  if to_regprocedure('public.consume_user_credits(character varying, integer)') is not null then
    grant execute on function public.consume_user_credits(varchar, integer) to service_role;
  end if;
end
$$;

-- The legacy feedback reward RPC is no longer an active application path.
-- Keep it unavailable even to service_role when present; production feedback
-- rewards should flow through public.submit_feedback_report() only.
do $$
begin
  if to_regprocedure('public.add_feedback_credits(character varying)') is not null then
    revoke execute on function public.add_feedback_credits(varchar) from public, anon, authenticated, service_role;
  end if;

  if to_regprocedure('public.add_feedback_credits(uuid)') is not null then
    revoke execute on function public.add_feedback_credits(uuid) from public, anon, authenticated, service_role;
  end if;
end
$$;

commit;
