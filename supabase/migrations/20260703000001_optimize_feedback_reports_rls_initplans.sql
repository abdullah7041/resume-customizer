-- Optimize active feedback_reports RLS policies flagged by auth_rls_initplan.
--
-- Supabase's performance advisor expects auth/JWT helper calls to be isolated
-- behind scalar select initplans. Keep the existing access model intact:
-- authenticated users may insert their own new report, admins may select/update,
-- and service_role remains available for server-side functions.

begin;

drop policy if exists feedback_reports_insert_own on public.feedback_reports;
drop policy if exists feedback_reports_admin_select on public.feedback_reports;
drop policy if exists feedback_reports_admin_update on public.feedback_reports;

create policy feedback_reports_insert_own
  on public.feedback_reports
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and user_email = ((select auth.jwt()) ->> 'email')
    and status = 'new'::feedback_report_status
    and priority = 'normal'::feedback_report_priority
    and reward_status = 'not_eligible'::feedback_reward_status
    and credits_awarded = 0
    and admin_notes is null
  );

create policy feedback_reports_admin_select
  on public.feedback_reports
  for select
  to authenticated
  using ((((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'));

create policy feedback_reports_admin_update
  on public.feedback_reports
  for update
  to authenticated
  using ((((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'))
  with check ((((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'));

comment on table public.feedback_reports is
  'Production feedback and bug reports. Browser RLS policies isolate auth.uid()/auth.jwt() helper calls behind scalar select initplans for Supabase auth_rls_initplan performance.';

commit;
