-- Run in Supabase before releasing company coverage requests.
create table public.company_coverage_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  careers_url text not null check (length(careers_url) between 9 and 2048),
  requested_at timestamptz not null default now(),
  -- Set when coverage is verified. A request never starts a crawler.
  company_id uuid references public.ats_companies(id) on delete set null,
  primary key (user_id, careers_url)
);
alter table public.company_coverage_requests enable row level security;
revoke all on public.company_coverage_requests from public, anon, authenticated;
grant select, insert, update, delete on public.company_coverage_requests to service_role;

-- A verified catalogue addition with the same careers page makes an existing
-- request followable. A reviewer can set company_id for a reviewed URL alias.
create view public.company_coverage_status with (security_invoker = true) as
select r.user_id, r.careers_url, r.requested_at,
       case when board.matches = 1 then
         jsonb_build_object('id', board.id, 'source', board.source, 'token', board.token, 'display_name', board.display_name)
       end as company
from public.company_coverage_requests r
left join lateral (
  select c.id, c.source, c.token, c.display_name, count(*) over () as matches
  from public.ats_companies c
  where c.id = r.company_id
     or (r.company_id is null and c.catalog_enabled and c.board_verified_at is not null
         and rtrim(c.careers_url, '/') = rtrim(r.careers_url, '/'))
  limit 1
) board on true;
revoke all on public.company_coverage_status from public, anon, authenticated;
grant select on public.company_coverage_status to service_role;
