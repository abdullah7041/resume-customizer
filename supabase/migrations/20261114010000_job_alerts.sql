-- Owner applies this migration; delivery remains disabled by default.
alter table public.job_postings add column if not exists publication_kind text not null default 'unknown' check (publication_kind in ('published','unknown'));
alter table public.job_postings add column if not exists publication_precision text not null default 'unknown' check (publication_precision in ('timestamp','date','unknown'));
-- Legacy normalized timestamps cannot establish original source precision. Re-crawl them.
create index if not exists job_postings_recent_publication on public.job_postings(posted_at) where closed_at is null and publication_kind = 'published' and publication_precision = 'timestamp';

create table public.job_alert_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default false,
 language text not null default 'en' check (language in ('ar','en')),
 token uuid not null default gen_random_uuid() unique,
 consent_at timestamptz,
 revision uuid not null default gen_random_uuid(),
 checked_at timestamptz not null default 'epoch',
 lease_until timestamptz,
 lease_owner uuid
);
create table public.job_alert_deliveries (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 cycle timestamptz not null,
 revision uuid not null,
 payload jsonb not null,
 posting_ids uuid[] not null,
 status text not null default 'pending' check (status in ('pending','sent','cancelled','uncertain')),
 created_at timestamptz not null default now(),
 attempted_at timestamptz,
 provider_id text,
 unique(user_id, cycle)
);
create table public.job_alert_items (
 user_id uuid not null references auth.users(id) on delete cascade,
 posting_id uuid not null references public.job_postings(id) on delete cascade,
 delivery_id uuid not null references public.job_alert_deliveries(id) on delete cascade,
 primary key(user_id, posting_id)
);
alter table public.job_alert_preferences enable row level security;
alter table public.job_alert_deliveries enable row level security;
alter table public.job_alert_items enable row level security;
revoke all on public.job_alert_preferences, public.job_alert_deliveries, public.job_alert_items from anon, authenticated;
grant select on public.job_alert_preferences to authenticated;
create policy own_alert_preferences on public.job_alert_preferences for select to authenticated using ((select auth.uid()) = user_id);
grant all on public.job_alert_preferences, public.job_alert_deliveries, public.job_alert_items to service_role;

-- A claimed subscription is one user's whole hourly cycle, including retries.
create function public.claim_job_alert_users(p_owner uuid, p_limit integer)
returns setof public.job_alert_preferences language sql security definer set search_path = public as $$
 update public.job_alert_preferences p set lease_owner = p_owner, lease_until = now() + interval '10 minutes', checked_at = now()
 where p.user_id in (
  select q.user_id from public.job_alert_preferences q
  where q.enabled and q.checked_at < date_trunc('hour', now()) and (q.lease_until is null or q.lease_until < now())
  order by q.checked_at limit least(p_limit, 50) for update skip locked
 ) returning p.*;
$$;
-- Fence ownership and reserve every user/posting before the first send.
create function public.prepare_job_alert(p_user uuid, p_owner uuid, p_revision uuid, p_ids uuid[], p_payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare delivery uuid;
begin
 perform 1 from public.job_alert_preferences where user_id=p_user and enabled and revision=p_revision and lease_owner=p_owner and lease_until>now() for update;
 if not found or cardinality(p_ids)=0 then return null; end if;
 if exists(select 1 from public.job_alert_items where user_id=p_user and posting_id=any(p_ids)) then return null; end if;
 insert into public.job_alert_deliveries(user_id,cycle,revision,payload,posting_ids)
 values(p_user,date_trunc('hour',now()),p_revision,p_payload,p_ids)
 on conflict(user_id,cycle) do nothing returning id into delivery;
 if delivery is null then return null; end if;
 insert into public.job_alert_items(user_id,posting_id,delivery_id) select p_user,unnest(p_ids),delivery;
 return delivery;
end;
$$;
revoke all on function public.claim_job_alert_users(uuid,integer), public.prepare_job_alert(uuid,uuid,uuid,uuid[],jsonb) from public, anon, authenticated;
grant execute on function public.claim_job_alert_users(uuid,integer), public.prepare_job_alert(uuid,uuid,uuid,uuid[],jsonb) to service_role;

-- Eligibility follows hourly schedule buckets, not completion time: a 00:05
-- completion must be eligible at 01:00 rather than waiting until 02:00.
alter table public.ats_companies add column last_crawl_cycle timestamptz;
create or replace function public.claim_job_crawl_batch(p_lease_until timestamptz, p_stale_before timestamptz, p_limit integer)
returns table(id uuid) language sql security definer set search_path=public as $$
 update public.ats_companies c set crawl_lease_until=p_lease_until, last_crawl_cycle=date_trunc('hour',now())
 where c.id in (
  select q.id from public.ats_companies q
  where exists(select 1 from public.user_tracked_companies t where t.company_id=q.id)
   and (q.last_crawl_cycle < date_trunc('hour',now()) or
    (q.last_crawl_cycle is null and (q.last_fetched_at is null or q.last_fetched_at < p_stale_before)))
   and (q.crawl_lease_until is null or q.crawl_lease_until<now())
  order by q.last_crawl_cycle nulls first, q.last_fetched_at nulls first
  limit least(p_limit,60) for update skip locked
 ) returning c.id;
$$;

-- Only a never-attempted digest can release jobs for future delivery.
create function public.cancel_job_alert(p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare attempted timestamptz;
begin
 update public.job_alert_deliveries
 set status=case when attempted_at is null then 'cancelled' else 'uncertain' end
 where id=p_id and status='pending' returning attempted_at into attempted;
 if found and attempted is null then
  delete from public.job_alert_items where delivery_id=p_id;
 end if;
end;
$$;
revoke all on function public.cancel_job_alert(uuid) from public, anon, authenticated;
grant execute on function public.cancel_job_alert(uuid) to service_role;
