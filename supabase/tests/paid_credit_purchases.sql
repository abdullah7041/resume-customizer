-- Run AFTER the paid-credit migration in a disposable Supabase environment.
-- All fixtures and changes roll back. This has not been run by the agent.
begin;
do $$
declare
  v_user uuid := gen_random_uuid();
  v_purchase uuid := gen_random_uuid();
  v_order uuid := gen_random_uuid();
  v_email varchar := 'paid-test-' || v_user::text || '@example.invalid';
  v_result jsonb;
  v_balance integer;
begin
  insert into auth.users(id, email) values (v_user, v_email);
  insert into public.user_credits(email, credits_remaining, credits_total)
    values(v_email, 20, 20) on conflict(email) do update set free_credits_remaining = 20;
  insert into public.credit_purchases(id,user_id,email,environment,session_id)
    values(v_purchase,v_user,v_email,'live',gen_random_uuid());
  perform public.record_credit_purchase(v_purchase,v_order,'succeeded',0);
  perform public.record_credit_purchase(v_purchase,v_order,'succeeded',0);
  select credits_remaining into v_balance from public.user_credits where email=v_email;
  if v_balance <> 120 then raise exception 'Duplicate grant: %',v_balance; end if;
  v_result := public.consume_user_credits_with_receipt(v_email,25);
  if (v_result->>'credits_remaining')::integer <> 95 then raise exception 'Wrong deduction'; end if;
  if (select remaining_credits from public.credit_purchases where id=v_purchase) <> 95 then raise exception 'Free-first failed'; end if;
  perform public.reset_free_credits(v_email,20);
  select credits_remaining into v_balance from public.user_credits where email=v_email;
  if v_balance <> 115 then raise exception 'Reset erased paid credits'; end if;
  perform public.refund_credit_debit(v_email,(v_result->>'debit_id')::uuid);
  perform public.refund_credit_debit(v_email,(v_result->>'debit_id')::uuid);
  if (select remaining_credits from public.credit_purchases where id=v_purchase) <> 100 then raise exception 'Debit restoration duplicated or lost'; end if;
  perform public.record_credit_purchase(v_purchase,v_order,'succeeded',1450);
  perform public.record_credit_purchase(v_purchase,v_order,'succeeded',0);
  if (select remaining_credits from public.credit_purchases where id=v_purchase) <> 50 then raise exception 'Partial refund/stale replay failed'; end if;
  perform public.record_credit_purchase(v_purchase,v_order,'refunded',2900);
  perform public.record_credit_purchase(v_purchase,v_order,'succeeded',0);
  if (select remaining_credits from public.credit_purchases where id=v_purchase) <> 0 then raise exception 'Refunded pack regranted'; end if;
end;
$$;
rollback;
