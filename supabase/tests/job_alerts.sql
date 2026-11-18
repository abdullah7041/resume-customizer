-- Run on the migrated preview database. All writes are rolled back.
begin;
do $$
declare
  member uuid := gen_random_uuid();
  other_member uuid := gen_random_uuid();
  company uuid := gen_random_uuid();
  posting uuid := gen_random_uuid();
  owner uuid := gen_random_uuid();
  revision uuid;
  delivery uuid;
begin
  insert into auth.users(id, email) values (member, member::text || '@example.test'), (other_member, other_member::text || '@example.test');
  insert into public.ats_companies(id, source, token, display_name, last_crawl_cycle, last_fetched_at)
  values (company, 'greenhouse', company::text, 'Fixture', date_trunc('hour', now()) - interval '1 hour', date_trunc('hour', now()) - interval '55 minutes');
  insert into public.user_tracked_companies(user_id, company_id) values (member, company);
  assert exists(select 1 from public.claim_job_crawl_batch(now() + interval '20 minutes', now() - interval '1 hour', 60) c where c.id=company), 'last-cycle completion must not delay the next scheduled crawl';
  assert not exists(select 1 from public.claim_job_crawl_batch(now() + interval '20 minutes', now() - interval '1 hour', 60) c where c.id=company), 'one crawl claim per company and hour';
  insert into public.job_postings(id, company_id, external_id, title) values(posting, company, 'one', 'Engineer');
  insert into public.job_alert_preferences(user_id, enabled) values(member, true), (other_member, false);
  select p.revision into revision from public.claim_job_alert_users(owner, 50) p where p.user_id=member;
  assert revision is not null, 'enabled member is claimed';
  assert not exists(select 1 from public.claim_job_alert_users(gen_random_uuid(), 50) p where p.user_id in (member, other_member)), 'overlap and opt-out must not be claimed';
  assert public.prepare_job_alert(member,gen_random_uuid(),revision,array[posting],'{}') is null, 'wrong owner must not reserve jobs';
  delivery := public.prepare_job_alert(member,owner,revision,array[posting],'{"to":"fixture@example.test"}');
  assert delivery is not null, 'first delivery reserves jobs';
  assert public.prepare_job_alert(member,owner,revision,array[posting],'{}') is null, 'same jobs cannot be reserved twice';
  perform public.cancel_job_alert(delivery);
  assert not exists(select 1 from public.job_alert_items i where i.delivery_id=delivery), 'never-attempted cancellations release reservations';
  assert public.prepare_job_alert(member,owner,revision,array[posting],'{}') is null, 'at most one digest per hour';
end $$;
rollback;
