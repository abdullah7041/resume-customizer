-- Restore durable auth.uid()-based ownership for legacy account tables.
--
-- The 2026-03 email refactor kept browser reads working by authorizing rows
-- with a JWT email claim. Email is mutable account data, while auth.uid() is
-- the durable tenant boundary. This forward migration adds user_id back to
-- legacy tables, backfills it from auth.users, and replaces email-claim RLS
-- policies with UUID ownership policies. Existing service-role app paths can
-- keep writing by email; the trigger below fills user_id for future rows.

begin;

alter table public.user_credits add column if not exists user_id uuid;
alter table public.credit_transactions add column if not exists user_id uuid;
alter table public.resumes add column if not exists user_id uuid;
alter table public.job_matches add column if not exists user_id uuid;
alter table public.feedback add column if not exists user_id uuid;

update public.user_credits target
set user_id = auth_user.id
from auth.users auth_user
where target.user_id is null
  and lower(target.email::text) = lower(auth_user.email);

update public.credit_transactions target
set user_id = auth_user.id
from auth.users auth_user
where target.user_id is null
  and target.email is not null
  and lower(target.email::text) = lower(auth_user.email);

update public.resumes target
set user_id = auth_user.id
from auth.users auth_user
where target.user_id is null
  and lower(target.email::text) = lower(auth_user.email);

update public.job_matches target
set user_id = auth_user.id
from auth.users auth_user
where target.user_id is null
  and target.email is not null
  and lower(target.email::text) = lower(auth_user.email);

update public.feedback target
set user_id = auth_user.id
from auth.users auth_user
where target.user_id is null
  and target.email is not null
  and lower(target.email::text) = lower(auth_user.email);

create index if not exists idx_user_credits_user_id on public.user_credits(user_id);
create index if not exists idx_credit_transactions_user_id on public.credit_transactions(user_id);
create index if not exists idx_resumes_user_id on public.resumes(user_id);
create index if not exists idx_job_matches_user_id on public.job_matches(user_id);
create index if not exists idx_feedback_user_id on public.feedback(user_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_credits_user_id_fkey'
      and conrelid = 'public.user_credits'::regclass
  ) then
    alter table public.user_credits
      add constraint user_credits_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'credit_transactions_user_id_fkey'
      and conrelid = 'public.credit_transactions'::regclass
  ) then
    alter table public.credit_transactions
      add constraint credit_transactions_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'resumes_user_id_fkey'
      and conrelid = 'public.resumes'::regclass
  ) then
    alter table public.resumes
      add constraint resumes_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_matches_user_id_fkey'
      and conrelid = 'public.job_matches'::regclass
  ) then
    alter table public.job_matches
      add constraint job_matches_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'feedback_user_id_fkey'
      and conrelid = 'public.feedback'::regclass
  ) then
    alter table public.feedback
      add constraint feedback_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade not valid;
  end if;
end
$$;

create or replace function public.set_legacy_account_user_id_from_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  matched_user_id uuid;
  should_lookup boolean;
begin
  if new.email is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    should_lookup := true;
  else
    should_lookup := new.user_id is null or new.email is distinct from old.email;
  end if;

  if should_lookup then
    select id
    into matched_user_id
    from auth.users
    where lower(email) = lower(new.email::text)
    order by created_at desc
    limit 1;

    if matched_user_id is not null then
      new.user_id := matched_user_id;
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.set_legacy_account_user_id_from_email()
  from public, anon, authenticated, service_role;

drop trigger if exists set_user_credits_user_id_from_email on public.user_credits;
create trigger set_user_credits_user_id_from_email
  before insert or update of email, user_id on public.user_credits
  for each row execute function public.set_legacy_account_user_id_from_email();

drop trigger if exists set_credit_transactions_user_id_from_email on public.credit_transactions;
create trigger set_credit_transactions_user_id_from_email
  before insert or update of email, user_id on public.credit_transactions
  for each row execute function public.set_legacy_account_user_id_from_email();

drop trigger if exists set_resumes_user_id_from_email on public.resumes;
create trigger set_resumes_user_id_from_email
  before insert or update of email, user_id on public.resumes
  for each row execute function public.set_legacy_account_user_id_from_email();

drop trigger if exists set_job_matches_user_id_from_email on public.job_matches;
create trigger set_job_matches_user_id_from_email
  before insert or update of email, user_id on public.job_matches
  for each row execute function public.set_legacy_account_user_id_from_email();

drop trigger if exists set_feedback_user_id_from_email on public.feedback;
create trigger set_feedback_user_id_from_email
  before insert or update of email, user_id on public.feedback
  for each row execute function public.set_legacy_account_user_id_from_email();

alter table public.user_profiles enable row level security;
alter table public.user_credits enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.resumes enable row level security;
alter table public.job_matches enable row level security;
alter table public.feedback enable row level security;

drop policy if exists "Users can read own profile" on public.user_profiles;
drop policy if exists "Users can insert own profile" on public.user_profiles;
drop policy if exists "Users can update own profile" on public.user_profiles;
drop policy if exists "user_profiles_select_policy_email" on public.user_profiles;
drop policy if exists "user_profiles_insert_policy_email" on public.user_profiles;
drop policy if exists "user_profiles_update_policy_email" on public.user_profiles;

create policy "user_profiles_select_own_user_id"
  on public.user_profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "user_profiles_insert_own_user_id"
  on public.user_profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "user_profiles_update_own_user_id"
  on public.user_profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "user_credits_select_policy_email" on public.user_credits;
drop policy if exists "user_credits_select_policy" on public.user_credits;
drop policy if exists "user_credits_insert_policy" on public.user_credits;
drop policy if exists "user_credits_update_policy" on public.user_credits;
drop policy if exists "user_credits_delete_policy" on public.user_credits;

create policy "user_credits_select_own_user_id"
  on public.user_credits
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "credit_transactions_select_policy_email" on public.credit_transactions;
drop policy if exists "credit_transactions_select_policy" on public.credit_transactions;

create policy "credit_transactions_select_own_user_id"
  on public.credit_transactions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "feedback_insert_policy_email" on public.feedback;
drop policy if exists "feedback_select_policy_email" on public.feedback;
drop policy if exists "feedback_insert_policy" on public.feedback;
drop policy if exists "feedback_select_policy" on public.feedback;
drop policy if exists "feedback_update_policy" on public.feedback;
drop policy if exists "feedback_delete_policy" on public.feedback;

create policy "feedback_insert_own_user_id"
  on public.feedback
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "feedback_select_own_user_id"
  on public.feedback
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "resumes_insert_policy_email" on public.resumes;
drop policy if exists "resumes_select_policy_email" on public.resumes;
drop policy if exists "resumes_update_policy_email" on public.resumes;
drop policy if exists "resumes_delete_policy_email" on public.resumes;
drop policy if exists "resumes_insert_policy" on public.resumes;
drop policy if exists "resumes_select_policy" on public.resumes;
drop policy if exists "resumes_update_policy" on public.resumes;
drop policy if exists "resumes_delete_policy" on public.resumes;

create policy "resumes_insert_own_user_id"
  on public.resumes
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "resumes_select_own_user_id"
  on public.resumes
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "resumes_update_own_user_id"
  on public.resumes
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "resumes_delete_own_user_id"
  on public.resumes
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "job_matches_insert_policy_email" on public.job_matches;
drop policy if exists "job_matches_select_policy_email" on public.job_matches;
drop policy if exists "job_matches_update_policy_email" on public.job_matches;
drop policy if exists "job_matches_delete_policy_email" on public.job_matches;
drop policy if exists "job_matches_insert_policy" on public.job_matches;
drop policy if exists "job_matches_select_policy" on public.job_matches;
drop policy if exists "job_matches_update_policy" on public.job_matches;
drop policy if exists "job_matches_delete_policy" on public.job_matches;

create policy "job_matches_insert_own_user_id"
  on public.job_matches
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "job_matches_select_own_user_id"
  on public.job_matches
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "job_matches_update_own_user_id"
  on public.job_matches
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "job_matches_delete_own_user_id"
  on public.job_matches
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

comment on function public.set_legacy_account_user_id_from_email()
  is 'Backfills durable auth.users ownership for legacy email-keyed account tables before RLS checks.';

commit;
