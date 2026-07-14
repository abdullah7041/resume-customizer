-- Tighten live RLS policies without rewriting applied migration history.

-- Service-role keys bypass RLS, so these policies are unnecessary.
drop policy if exists credit_transactions_insert_service on public.credit_transactions;
drop policy if exists feedback_service_role on public.feedback;
drop policy if exists user_credits_service_role on public.user_credits;
drop policy if exists user_credits_service_role_select on public.user_credits;
drop policy if exists user_credits_service_role_insert on public.user_credits;
drop policy if exists user_credits_service_role_update on public.user_credits;
drop policy if exists user_credits_service_role_delete on public.user_credits;
drop policy if exists waitlist_select_policy on public.waitlist;

-- Permissive policies combine with OR, so remove every prior INSERT variant.
drop policy if exists "Anyone can join waitlist" on public.waitlist;
drop policy if exists waitlist_insert_policy on public.waitlist;
create policy "Anyone can join waitlist"
  on public.waitlist
  for insert
  to anon, authenticated
  with check (
    email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    and notified_at is null
    and plan_type in ('pro', 'enterprise')
  );

revoke insert on public.waitlist from anon, authenticated;
grant insert (email, plan_type, language, metadata)
  on public.waitlist
  to anon, authenticated;
