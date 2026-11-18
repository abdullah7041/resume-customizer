-- Run manually in Supabase SQL editor. Never run automatically during deploy.
-- credits_remaining remains the total; monthly/reward credits are the free bucket.
begin;

alter table public.user_credits
  add column free_credits_remaining integer not null default 0,
  add column purchased_credits_remaining integer not null default 0,
  add column last_credit_debit_id uuid;
update public.user_credits set free_credits_remaining = credits_remaining;
alter table public.user_credits add constraint user_credits_bucket_balance check (
  free_credits_remaining >= 0 and purchased_credits_remaining >= 0
  and credits_remaining = free_credits_remaining + purchased_credits_remaining
);
revoke all on public.user_credits from anon, authenticated;
grant select on public.user_credits to authenticated;
grant select, insert, update, delete on public.user_credits to service_role;

create table public.credit_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email varchar not null,
  amount_minor integer not null default 2900 check (amount_minor = 2900),
  currency text not null default 'SAR' check (currency = 'SAR'),
  environment text not null check (environment in ('sandbox', 'live')),
  session_id uuid unique,
  order_id uuid unique,
  status text not null default 'created' check (status in ('created','pending','succeeded','failed','cancelled','refunded')),
  remaining_credits integer not null default 0 check (remaining_credits between 0 and 100),
  granted_at timestamptz,
  refunded_minor integer not null default 0 check (refunded_minor between 0 and 2900),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (environment = 'live' or remaining_credits = 0)
);
create index credit_purchases_email_lots on public.credit_purchases(email, created_at, id)
  where remaining_credits > 0;

-- A debit remembers the exact funding lots so an AI failure cannot turn paid
-- credits into free credits or restore credits already returned as money.
create table public.credit_debits (
  id uuid primary key default gen_random_uuid(),
  email varchar not null references public.user_credits(email) on delete cascade,
  free_amount integer not null check (free_amount >= 0),
  paid_allocations jsonb not null default '[]'::jsonb,
  refunded_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.credit_purchases enable row level security;
alter table public.credit_debits enable row level security;
revoke all on public.credit_purchases, public.credit_debits from public, anon, authenticated;
grant select, insert, update, delete on public.credit_purchases, public.credit_debits to service_role;

-- All legacy writers still change the total. This trigger routes additions to
-- free credits and deductions free-first, including existing direct UPDATEs.
-- Every operation locks user_credits BEFORE purchase lots (same order as RPCs).
create function public.sync_credit_buckets() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_delta integer;
  v_paid_needed integer;
  v_take integer;
  v_free_used integer;
  v_allocations jsonb := '[]'::jsonb;
  v_lot record;
begin
  if tg_op = 'INSERT' then
    if new.purchased_credits_remaining <> 0 then
      raise exception 'Purchased credits require a purchase';
    end if;
    new.free_credits_remaining := new.credits_remaining;
    return new;
  end if;
  if new.email is distinct from old.email and old.purchased_credits_remaining > 0 then
    raise exception 'Cannot change the email of funded credits';
  end if;
  if new.free_credits_remaining is distinct from old.free_credits_remaining
     or new.purchased_credits_remaining is distinct from old.purchased_credits_remaining then
    new.credits_remaining := new.free_credits_remaining + new.purchased_credits_remaining;
  else
    v_delta := new.credits_remaining - old.credits_remaining;
    if v_delta >= 0 then
      new.free_credits_remaining := old.free_credits_remaining + v_delta;
    else
      if new.credits_remaining < 0 then raise exception 'Insufficient credits'; end if;
      v_free_used := least(old.free_credits_remaining, -v_delta);
      new.free_credits_remaining := old.free_credits_remaining - v_free_used;
      v_paid_needed := -v_delta - v_free_used;
      for v_lot in select id, remaining_credits from public.credit_purchases
        where email = old.email and remaining_credits > 0
        order by created_at, id for update
      loop
        exit when v_paid_needed = 0;
        v_take := least(v_paid_needed, v_lot.remaining_credits);
        update public.credit_purchases set remaining_credits = remaining_credits - v_take, updated_at = now()
          where id = v_lot.id;
        v_allocations := v_allocations || jsonb_build_array(jsonb_build_object('purchase_id', v_lot.id, 'amount', v_take));
        v_paid_needed := v_paid_needed - v_take;
      end loop;
      if v_paid_needed <> 0 then raise exception 'Purchased credit lots do not match balance'; end if;
      new.purchased_credits_remaining := old.purchased_credits_remaining - (-v_delta - v_free_used);
      insert into public.credit_debits(email, free_amount, paid_allocations)
        values (old.email, v_free_used, v_allocations) returning id into new.last_credit_debit_id;
    end if;
  end if;
  if new.purchased_credits_remaining <> (
    select coalesce(sum(remaining_credits), 0) from public.credit_purchases where email = new.email
  ) then raise exception 'Purchased credit lots do not match balance'; end if;
  return new;
end;
$$;
create trigger sync_credit_buckets before insert or update on public.user_credits
  for each row execute function public.sync_credit_buckets();

create function public.record_credit_purchase(
  p_purchase_id uuid, p_order_id uuid, p_status text, p_refunded_minor integer default 0
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_purchase public.credit_purchases%rowtype;
  v_email varchar;
  v_balance integer;
  v_grant integer := 0;
  v_revoke integer := 0;
  v_refund integer;
begin
  if p_status is null or p_status not in ('pending','succeeded','failed','cancelled','refunded')
     or p_refunded_minor is null or p_refunded_minor < 0 or p_refunded_minor > 2900 then
    raise exception 'Invalid purchase result';
  end if;
  select email into v_email from public.credit_purchases where id = p_purchase_id;
  if not found then raise exception 'Purchase not found'; end if;
  select credits_remaining into v_balance from public.user_credits where email = v_email for update;
  if not found then raise exception 'User credits record not found'; end if;
  select * into v_purchase from public.credit_purchases where id = p_purchase_id for update;
  if v_purchase.session_id is null then raise exception 'Purchase session is not ready'; end if;
  if not exists (select 1 from auth.users where id = v_purchase.user_id and email = v_purchase.email) then
    raise exception 'Purchase owner mismatch';
  end if;
  if v_purchase.order_id is not null and v_purchase.order_id is distinct from p_order_id then
    raise exception 'Purchase order mismatch';
  end if;
  if p_order_id is null and p_status in ('succeeded','refunded') then raise exception 'Order is required'; end if;
  v_refund := greatest(v_purchase.refunded_minor, p_refunded_minor);
  if p_status = 'refunded' and v_refund <> 2900 then raise exception 'Full refund amount required'; end if;
  if v_purchase.environment = 'live' and p_status = 'succeeded'
     and v_purchase.granted_at is null and v_purchase.status <> 'refunded' and v_refund < 2900 then
    v_grant := 100;
  end if;
  -- Cumulative refunds remove the newly refunded entitlement, capped at the
  -- unspent lot. Rounding up never leaves credits for money already returned.
  if v_purchase.environment = 'live' then
    v_revoke := least(v_purchase.remaining_credits + v_grant,
      ceil(100.0 * v_refund / 2900)::integer - case when v_grant > 0 then 0 else ceil(100.0 * v_purchase.refunded_minor / 2900)::integer end);
  end if;
  update public.credit_purchases set
    order_id = coalesce(order_id, p_order_id),
    status = case when v_refund = 2900 or status = 'refunded' then 'refunded'
      when granted_at is not null or v_grant > 0 then 'succeeded' else p_status end,
    remaining_credits = remaining_credits + v_grant - v_revoke,
    granted_at = case when v_grant > 0 then now() else granted_at end,
    refunded_minor = v_refund, updated_at = now()
    where id = p_purchase_id returning * into v_purchase;
  update public.user_credits set
    purchased_credits_remaining = purchased_credits_remaining + v_grant - v_revoke,
    credits_total = credits_total + v_grant,
    updated_at = now()
    where email = v_email returning credits_remaining into v_balance;
  return jsonb_build_object('status', v_purchase.status, 'granted', v_grant > 0, 'credits_remaining', v_balance);
end;
$$;

create function public.consume_user_credits_with_receipt(p_email varchar, p_amount integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_balance integer; v_id uuid;
begin
  -- Existing RPC validates and locks the account; the trigger records its lots.
  v_balance := public.consume_user_credits(p_email, p_amount);
  select last_credit_debit_id into v_id from public.user_credits where email = p_email;
  return jsonb_build_object('credits_remaining', v_balance, 'debit_id', v_id);
end;
$$;

create function public.refund_credit_debit(p_email varchar, p_debit_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_debit public.credit_debits%rowtype;
  v_lot public.credit_purchases%rowtype;
  v_allocation jsonb;
  v_paid integer := 0;
  v_restore integer;
  v_balance integer;
begin
  select credits_remaining into v_balance from public.user_credits where email = p_email for update;
  if not found then raise exception 'User credits record not found'; end if;
  select * into v_debit from public.credit_debits where id = p_debit_id and email = p_email for update;
  if not found then raise exception 'Credit debit not found'; end if;
  if v_debit.refunded_at is not null then
    return jsonb_build_object('credits_remaining', v_balance, 'restored', false);
  end if;
  for v_allocation in select value from jsonb_array_elements(v_debit.paid_allocations) loop
    select * into v_lot from public.credit_purchases where id = (v_allocation->>'purchase_id')::uuid for update;
    if not found then raise exception 'Purchase lot not found'; end if;
    v_restore := least((v_allocation->>'amount')::integer,
      greatest(0, 100 - ceil(100.0 * v_lot.refunded_minor / 2900)::integer - v_lot.remaining_credits));
    update public.credit_purchases set remaining_credits = remaining_credits + v_restore, updated_at = now() where id = v_lot.id;
    v_paid := v_paid + v_restore;
  end loop;
  update public.user_credits set free_credits_remaining = free_credits_remaining + v_debit.free_amount,
    purchased_credits_remaining = purchased_credits_remaining + v_paid, updated_at = now()
    where email = p_email returning credits_remaining into v_balance;
  update public.credit_debits set refunded_at = now() where id = p_debit_id;
  return jsonb_build_object('credits_remaining', v_balance, 'restored', true);
end;
$$;

create function public.reset_free_credits(p_email varchar, p_amount integer default 20)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_before integer; v_after integer;
begin
  if p_amount is null or p_amount < 0 or p_amount > 20 then raise exception 'Free allowance must be between 0 and 20'; end if;
  select credits_remaining into v_before from public.user_credits where email = p_email for update;
  if not found then raise exception 'User credits record not found'; end if;
  update public.user_credits set free_credits_remaining = p_amount,
    credits_total = p_amount + purchased_credits_remaining,
    last_reset_date = now(), updated_at = now()
    where email = p_email returning credits_remaining into v_after;
  insert into public.credit_transactions(email, feature, transaction_type, amount, credits_before, credits_after)
    values (p_email, 'monthly_reset', 'monthly_reset', v_after - v_before, v_before, v_after);
  return jsonb_build_object('credits_remaining', v_after);
end;
$$;

-- A pending initial grant can coexist with a payment: never replace its total.
create or replace function public.grant_initial_credits(p_email text, p_amount integer, p_ip_address text default null)
returns table(granted boolean, credits_remaining integer)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row public.user_credits%rowtype; v_after integer;
begin
  if p_amount is null or p_amount < 0 or p_amount > 20 then raise exception 'Initial credit amount must be between 0 and 20'; end if;
  select * into v_row from public.user_credits where email = p_email for update;
  if not found then raise exception 'User credits record not found'; end if;
  if v_row.signup_metadata->>'pending_initial_grant' is distinct from 'true' then
    return query select false, v_row.credits_remaining;
    return;
  end if;
  update public.user_credits set free_credits_remaining = free_credits_remaining + p_amount,
    credits_total = credits_total + p_amount,
    signup_metadata = coalesce(signup_metadata, '{}'::jsonb) || jsonb_build_object(
      'pending_initial_grant', false, 'initial_grant_at', now(), 'ip_address', p_ip_address), updated_at = now()
    where email = p_email returning user_credits.credits_remaining into v_after;
  insert into public.credit_transactions(email, feature, transaction_type, amount, credits_before, credits_after)
    values (p_email, 'initial_grant', 'initial_grant', p_amount, v_row.credits_remaining, v_after);
  return query select true, v_after;
end;
$$;

revoke all on function public.sync_credit_buckets() from public, anon, authenticated;
revoke all on function public.record_credit_purchase(uuid, uuid, text, integer) from public, anon, authenticated;
revoke all on function public.consume_user_credits_with_receipt(varchar, integer) from public, anon, authenticated;
revoke all on function public.refund_credit_debit(varchar, uuid) from public, anon, authenticated;
revoke all on function public.reset_free_credits(varchar, integer) from public, anon, authenticated;
grant execute on function public.record_credit_purchase(uuid, uuid, text, integer) to service_role;
grant execute on function public.consume_user_credits_with_receipt(varchar, integer) to service_role;
grant execute on function public.refund_credit_debit(varchar, uuid) to service_role;
grant execute on function public.reset_free_credits(varchar, integer) to service_role;

commit;
