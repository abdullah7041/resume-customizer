-- Run in the Supabase SQL editor. This records sandbox qualification only;
-- it never mutates credits, subscriptions, or other customer entitlements.
begin;

create table public.geidea_sandbox_payments (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_minor integer not null check (amount_minor = 100),
  currency text not null check (currency = 'SAR'),
  session_id uuid unique,
  order_id uuid unique,
  status text not null default 'created'
    check (status in ('created', 'pending', 'succeeded', 'failed', 'cancelled', 'refunded')),
  brand text check (length(brand) <= 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.geidea_sandbox_payments enable row level security;
revoke all on public.geidea_sandbox_payments from public, anon, authenticated;
grant select, insert, update on public.geidea_sandbox_payments to service_role;

create function public.record_geidea_sandbox_result(
  p_payment_id uuid, p_order_id uuid, p_status text, p_brand text
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_payment public.geidea_sandbox_payments%rowtype;
begin
  if p_order_id is null or p_status is null or
     p_status not in ('pending', 'succeeded', 'failed', 'cancelled', 'refunded') then
    raise exception 'Invalid payment result';
  end if;
  select * into v_payment from public.geidea_sandbox_payments where id = p_payment_id for update;
  if not found or v_payment.session_id is null then
    raise exception 'Payment is not ready';
  end if;
  if v_payment.order_id is not null and v_payment.order_id <> p_order_id then
    raise exception 'Payment order mismatch';
  end if;

  -- Repeat delivery is harmless. Stale failures cannot undo a paid order;
  -- paid/refunded results can advance a previously pending or failed order.
  if v_payment.status <> 'refunded' and
     (p_status = 'refunded' or p_status = 'succeeded' or v_payment.status in ('created', 'pending')) then
    update public.geidea_sandbox_payments set
      order_id = p_order_id, status = p_status, brand = p_brand, updated_at = now()
    where id = p_payment_id;
  end if;
  return (select jsonb_build_object('status', status) from public.geidea_sandbox_payments where id = p_payment_id);
end;
$$;

revoke all on function public.record_geidea_sandbox_result(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_geidea_sandbox_result(uuid, uuid, text, text) to service_role;

commit;
