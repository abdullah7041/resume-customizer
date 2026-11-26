-- Run against a migrated preview database. All fixture writes are rolled back.
begin;
do $$
declare
  member uuid := gen_random_uuid();
  employer uuid := gen_random_uuid();
  page text := 'https://careers.example.org/' || employer::text;
begin
  insert into auth.users(id, email) values(member, member::text || '@example.test');
  insert into public.company_coverage_requests(user_id, careers_url)
    values(member, page), (member, page) on conflict do nothing;
  assert (select count(*) from public.company_coverage_requests where user_id=member) = 1;
  assert (select company is null from public.company_coverage_status where user_id=member);
  assert not has_table_privilege('authenticated','public.company_coverage_status','select');
  assert not has_table_privilege('authenticated','public.company_coverage_requests','insert');
  insert into public.ats_companies(id, source, token, display_name, careers_url)
    values(employer,'ashby',employer::text,'Fixture',page || '/');
  assert (select company is null from public.company_coverage_status where user_id=member);
  update public.ats_companies set catalog_enabled=true, board_verified_at=now() where id=employer;
  assert (select company->>'id' from public.company_coverage_status where user_id=member) = employer::text;
  assert not exists(select 1 from public.user_tracked_companies where user_id=member);
end $$;
rollback;
