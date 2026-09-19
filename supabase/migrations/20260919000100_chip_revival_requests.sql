create table if not exists public.canfes_revival_requests (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.canfes_accounts(id) on delete cascade,
  requested_at timestamptz not null default now(),
  eligible_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists canfes_revival_requests_pending_account_idx
  on public.canfes_revival_requests (account_id)
  where status = 'pending';
create index if not exists canfes_revival_requests_status_requested_idx
  on public.canfes_revival_requests (status, requested_at desc);
create index if not exists canfes_revival_requests_reviewed_by_idx
  on public.canfes_revival_requests (reviewed_by);

alter table public.canfes_revival_requests enable row level security;
revoke all on public.canfes_revival_requests from anon, authenticated;

create or replace function public.approve_canfes_revival(
  p_request_id uuid,
  p_staff_id uuid
)
returns table(display_name text, resulting_balance integer, eligible_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.canfes_revival_requests%rowtype;
  v_display_name text;
  v_balance integer;
begin
  select r.*
    into v_request
    from public.canfes_revival_requests as r
   where r.id = p_request_id
   for update;

  if not found then
    raise exception 'revival_request_not_found';
  end if;
  select a.display_name
    into v_display_name
    from public.canfes_accounts as a
   where a.id = v_request.account_id and a.active = true
   for update;
  if not found then
    raise exception 'revival_request_not_found';
  end if;
  select b.amount
    into v_balance
    from public.canfes_balances as b
   where b.account_id = v_request.account_id
   for update;
  if not found then
    raise exception 'revival_request_not_found';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'revival_request_already_processed';
  end if;
  if v_request.eligible_at > now() then
    raise exception 'revival_not_ready';
  end if;
  if v_balance <> 0 then
    raise exception 'revival_balance_not_zero';
  end if;

  update public.canfes_balances
     set amount = 300, updated_at = now()
   where account_id = v_request.account_id;

  insert into public.canfes_transactions (id, account_id, amount, type, name)
  values (v_request.id, v_request.account_id, 300, 'revival', 'チップ復活');

  update public.canfes_revival_requests
     set status = 'approved', reviewed_by = p_staff_id, reviewed_at = now()
   where id = v_request.id;

  return query select v_display_name, 300, v_request.eligible_at;
end;
$$;

revoke all on function public.approve_canfes_revival(uuid, uuid) from public, anon, authenticated;
grant execute on function public.approve_canfes_revival(uuid, uuid) to service_role;
