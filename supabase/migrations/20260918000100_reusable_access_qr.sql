alter table public.canfes_access_codes
  add column if not exists reusable boolean not null default false;

create or replace function public.claim_canfes_access_code(
  p_code text,
  p_display_name text,
  p_session_token_hash text
)
returns table(account_id uuid, display_name text, balance integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code public.canfes_access_codes%rowtype;
  v_account_id uuid;
  v_display_name text;
begin
  select * into v_code
  from public.canfes_access_codes
  where code = upper(trim(p_code)) and (used_at is null or reusable)
  for update;

  if not found then
    raise exception 'invalid_or_used_code';
  end if;

  v_display_name := coalesce(nullif(trim(p_display_name), ''), '参加者');

  insert into public.canfes_accounts (display_name, session_token_hash, access_code_id)
  values (v_display_name, p_session_token_hash, v_code.id)
  returning id into v_account_id;

  insert into public.canfes_balances (account_id, amount)
  values (v_account_id, v_code.initial_amount);

  if not v_code.reusable then
    update public.canfes_access_codes
    set used_at = now(), used_by = v_account_id
    where id = v_code.id;
  end if;

  return query select v_account_id, v_display_name, v_code.initial_amount;
end;
$$;
