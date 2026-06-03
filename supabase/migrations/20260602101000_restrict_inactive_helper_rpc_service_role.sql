-- Restrict inactive helper RPCs after live verification.
--
-- The active server-side RPC allowlist is:
-- - public.add_credits(varchar, integer, text, text)
-- - public.consume_user_credits(varchar, integer)
-- - public.submit_feedback_report(...)
--
-- Trigger/helper functions should not be exposed as callable RPCs to browser
-- roles or service_role. Existing triggers can still invoke trigger functions.

begin;

do $$
begin
  if to_regprocedure('public.initialize_user_credits()') is not null then
    revoke execute on function public.initialize_user_credits() from public, anon, authenticated, service_role;
    alter function public.initialize_user_credits() set search_path = public, pg_temp;
  end if;

  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated, service_role;
    alter function public.rls_auto_enable() set search_path = public, pg_temp;
  end if;
end
$$;

commit;
