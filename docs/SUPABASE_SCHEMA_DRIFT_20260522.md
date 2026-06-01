# Supabase Schema Drift Check - 2026-05-22

Last grant re-check: 2026-06-02 via Supabase connector, read-only query.

## Scope

Compared the live Supabase project `Resume-customizer` (`cwcjeujextkwpmzdfzdz`) against:

- `supabase/migrations/20260521_add_ai_usage_events.sql`
- `supabase/migrations/20260522_add_job_applications.sql`

No migrations were applied during this check.

## Already Live

### `public.ai_usage_events`

- Table exists with the local column shape: identity bigint `id`, token/cost/latency fields, `success`, nullable `error_code`, and `created_at timestamptz default now()`.
- Primary key exists on `id`.
- RLS is enabled.
- No RLS policies exist. This is intentional for server-side/service-role-only inserts.
- Supabase migration history contains `20260520231528 add_ai_usage_events`.

### `public.job_applications`

- Table exists with the local column shape, including `user_id`, job metadata, status/outcome fields, export path/name, `metadata jsonb default '{}'`, and timestamps.
- Primary key, `user_id -> auth.users(id) on delete cascade`, status check, and match-score check exist.
- Indexes exist:
  - `idx_job_applications_user_id`
  - `idx_job_applications_user_status`
  - `idx_job_applications_user_updated_at_desc`
- `trg_job_applications_updated_at` exists and calls `public.update_updated_at_column()`.
- RLS is enabled.
- RLS policies match the local intent: authenticated users can select, insert, update, and delete only rows where `auth.uid() = user_id`.
- Supabase migration history contains `20260521090252 add_job_applications` and `20260521090446 harden_job_applications_updated_at_search_path`.

## Drift Status

Resolved as of the 2026-06-02 read-only re-check. The live schema matches the local table/constraint/index/trigger/RLS policy shape, and the previously documented client-role grant drift is no longer present:

- `public.ai_usage_events` has no `anon` or `authenticated` grants; `service_role` retains server-side table privileges including `INSERT`.
- `public.job_applications` has no `anon` grants; `authenticated` has only `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.

The same read-only grant query still shows broad `service_role` grants on both tables. This note does not recommend revoking `service_role`: Watheq server-side Supabase access intentionally uses `SUPABASE_SERVICE_ROLE_KEY`.

RLS prevents row access where policies do not allow it, but privilege-level operations such as `TRUNCATE` are not row-policy checks. The local SQL explicitly revokes broad client-role grants before granting only the intended access.

## Manual Dashboard SQL

No manual dashboard SQL is currently needed for this grant drift. Keep this block as the safe, idempotent recovery SQL only if a future read-only grant query shows the same client-role drift has returned. Do not rerun the full create-table migrations against production.

```sql
revoke all on public.ai_usage_events from anon;
revoke all on public.ai_usage_events from authenticated;
grant insert on public.ai_usage_events to service_role;

revoke all on public.job_applications from anon;
revoke all on public.job_applications from authenticated;
grant select, insert, update, delete on public.job_applications to authenticated;
```

After running it, re-check:

```sql
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('ai_usage_events', 'job_applications')
  and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;
```

Expected result:

- `ai_usage_events`: no `anon` or `authenticated` grants; `service_role` still has insert capability for server-side logging.
- `job_applications`: no `anon` grants; `authenticated` has only `SELECT`, `INSERT`, `UPDATE`, and `DELETE`; `service_role` remains available for server-side maintenance paths.

2026-06-02 live result matched this expected client-role shape.

## Notes

- The local migration filenames do not match the already-applied live Supabase migration versions, so treat the local files as source-controlled reference SQL and use the recovery SQL above only if a future read-only grant check shows client-role drift has returned.
- Supabase Security Advisor reports `RLS Enabled No Policy` for `public.ai_usage_events`. That is expected for the current service-role-only logging design.
- The 2026-06-02 read-only telemetry check found `public.ai_usage_events` still empty with `n_tup_ins = 0`. That is tracked as missing production traffic evidence, not schema drift.
