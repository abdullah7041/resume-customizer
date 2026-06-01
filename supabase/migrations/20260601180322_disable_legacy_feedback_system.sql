-- Disable the legacy Supabase-backed feedback flow while preserving archived rows.
-- The app/API path has been removed; this migration prevents new legacy writes and
-- disables the feedback reward RPC without dropping historical feedback or ledger data.

do $$
begin
  if to_regclass('public.feedback') is not null then
    execute 'drop policy if exists feedback_select_own on public.feedback';
    execute 'drop policy if exists feedback_insert_own on public.feedback';
    execute 'drop policy if exists feedback_service_role on public.feedback';

    revoke all on table public.feedback from public, anon, authenticated, service_role;
    grant select on table public.feedback to service_role;
  end if;
end
$$;

do $$
begin
  if to_regprocedure('public.add_feedback_credits(character varying)') is not null then
    revoke execute on function public.add_feedback_credits(varchar) from public, anon, authenticated, service_role;
  end if;
end
$$;

do $$
begin
  if to_regprocedure('public.add_feedback_credits(uuid)') is not null then
    revoke execute on function public.add_feedback_credits(uuid) from public, anon, authenticated, service_role;
  end if;
end
$$;
