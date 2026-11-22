-- Run manually in Supabase. Catalogue inclusion is service-role managed.
alter table public.ats_companies
 add column catalog_enabled boolean not null default false,
 add column company_category text not null default 'unclassified' check(company_category in ('startup','scaleup','enterprise','public_sector','unclassified')),
 add column sector text,
 add column board_verification_source text,
 add column board_verified_at timestamptz,
 add column classification_source text,
 add column classification_verified_at timestamptz;
create index ats_companies_catalogue on public.ats_companies(id) where catalog_enabled;
create or replace function public.claim_job_crawl_batch(p_lease_until timestamptz,p_stale_before timestamptz,p_limit integer)
returns table(id uuid) language sql security definer set search_path=public as $$
 update public.ats_companies c set crawl_lease_until=p_lease_until,last_crawl_cycle=date_trunc('hour',now())
 where c.id in (
 select q.id from public.ats_companies q
 where (q.catalog_enabled or exists(select 1 from public.user_tracked_companies t where t.company_id=q.id))
 and (q.last_crawl_cycle<date_trunc('hour',now()) or (q.last_crawl_cycle is null and (q.last_fetched_at is null or q.last_fetched_at<p_stale_before)))
 and (q.crawl_lease_until is null or q.crawl_lease_until<now())
 order by q.last_crawl_cycle nulls first,q.last_fetched_at nulls first
 limit least(p_limit,60) for update skip locked) returning c.id;
$$;
revoke all on function public.claim_job_crawl_batch(timestamptz,timestamptz,integer) from public,anon,authenticated;
grant execute on function public.claim_job_crawl_batch(timestamptz,timestamptz,integer) to service_role;
