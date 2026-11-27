-- Apply before deploying the catalogue check history. Only authenticated server
-- functions read and write match narratives; the browser receives its own page.
begin;
create table if not exists public.user_job_feed_checks (
  user_id uuid not null references auth.users(id) on delete cascade,
  posting_id uuid not null references public.job_postings(id) on delete cascade,
  resume_id text not null,
  resume_revision text not null,
  language text not null check (language in ('ar','en')),
  contract text not null,
  job_revision text not null,
  match jsonb not null,
  primary key (user_id, posting_id, resume_id, resume_revision, language, contract, job_revision)
);
alter table public.user_job_feed_checks enable row level security;
revoke all on public.user_job_feed_checks from public, anon, authenticated;
grant select, insert, update, delete on public.user_job_feed_checks to service_role;

create or replace function public.read_feed_checks(
  p_user uuid, p_postings uuid[], p_resume text, p_revision text, p_language text, p_contract text
)
returns table (posting_id uuid, job_revision text, match jsonb)
language sql stable security invoker set search_path = '' as $$
  select p.id, current_check.job_revision, current_check.match
  from public.job_postings p
  left join public.user_job_feed_checks current_check
    on current_check.user_id = p_user and current_check.posting_id = p.id
    and current_check.resume_id = p_resume and current_check.resume_revision = p_revision
    and current_check.language = p_language and current_check.contract = p_contract
    and current_check.job_revision = encode(sha256(convert_to(p.description, 'UTF8')), 'hex')
  where p.id = any(p_postings) and exists (
    select 1 from public.user_job_feed_checks previous
    where previous.user_id = p_user and previous.posting_id = p.id
  );
$$;
revoke all on function public.read_feed_checks(uuid, uuid[], text, text, text, text) from public, anon, authenticated;
grant execute on function public.read_feed_checks(uuid, uuid[], text, text, text, text) to service_role;
commit;
