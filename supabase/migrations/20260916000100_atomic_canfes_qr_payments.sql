create or replace function public.apply_canfes_payment_request(
  p_request_id uuid,
  p_account_id uuid,
  p_amount integer,
  p_mode text
)
returns table(display_name text, resulting_balance integer, already_completed boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display_name text;
  v_balance integer;
  v_existing public.canfes_transactions%rowtype;
begin
  if p_amount < 1 or p_amount > 100000 or p_mode not in ('purchase', 'refund') then
    raise exception 'invalid_payment_request';
  end if;

  select a.display_name into v_display_name
  from public.canfes_accounts as a
  where a.id = p_account_id and a.active = true
  for update;

  if not found then
    raise exception 'account_not_active';
  end if;

  insert into public.canfes_transactions (id, account_id, amount, type, name)
  values (
    p_request_id,
    p_account_id,
    case when p_mode = 'purchase' then p_amount else -p_amount end,
    case when p_mode = 'purchase' then 'charge' else 'spend' end,
    case when p_mode = 'purchase' then 'チップ購入' else 'チップ払い戻し' end
  )
  on conflict (id) do nothing;

  if not found then
    select t.* into v_existing
    from public.canfes_transactions as t
    where t.id = p_request_id;

    if v_existing.account_id <> p_account_id
      or v_existing.amount <> (case when p_mode = 'purchase' then p_amount else -p_amount end) then
      raise exception 'payment_request_conflict';
    end if;

    select b.amount into v_balance
    from public.canfes_balances as b
    where b.account_id = p_account_id;
    return query select v_display_name, coalesce(v_balance, 0), true;
    return;
  end if;

  if p_mode = 'purchase' then
    update public.canfes_balances as b
    set amount = b.amount + p_amount, updated_at = now()
    where b.account_id = p_account_id
    returning b.amount into v_balance;
  else
    update public.canfes_balances as b
    set amount = b.amount - p_amount, updated_at = now()
    where b.account_id = p_account_id and b.amount >= p_amount
    returning b.amount into v_balance;
    if not found then
      raise exception 'insufficient_balance';
    end if;
  end if;

  if v_balance is null then
    raise exception 'balance_not_found';
  end if;

  return query select v_display_name, v_balance, false;
end;
$$;

revoke all on function public.apply_canfes_payment_request(uuid, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.apply_canfes_payment_request(uuid, uuid, integer, text) to service_role;
