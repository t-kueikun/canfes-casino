-- 爆裂カジノ / キャンパスフェスティバル横浜キャンパス schema
-- 運営だけがSupabase Authを使い、参加者はこのDBのアカウントを使う。

create extension if not exists pgcrypto;

create table if not exists public.canfes_access_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  initial_amount integer not null default 300 check (initial_amount >= 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  used_by uuid
);

create table if not exists public.canfes_accounts (
  id uuid primary key default gen_random_uuid(),
  display_name text not null default '参加者',
  session_token_hash text unique not null,
  access_code_id uuid references public.canfes_access_codes(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.canfes_balances (
  account_id uuid primary key references public.canfes_accounts(id) on delete cascade,
  amount integer not null default 0 check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.canfes_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.canfes_accounts(id) on delete cascade,
  amount integer not null,
  type text not null,
  name text not null,
  timestamp timestamptz not null default now()
);

create table if not exists public.canfes_bingo_cards (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.canfes_accounts(id) on delete cascade,
  numbers jsonb not null,
  marked_numbers integer[] not null default '{0}',
  created_at timestamptz not null default now()
);

create table if not exists public.canfes_bingo_draw_state (
  id integer primary key check (id = 1),
  drawn_numbers integer[] not null default '{}',
  current_number integer,
  active boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.canfes_bingo_draw_state (id)
values (1)
on conflict (id) do nothing;

create index if not exists canfes_access_codes_created_by_idx on public.canfes_access_codes (created_by, created_at desc);
create index if not exists canfes_transactions_account_timestamp_idx on public.canfes_transactions (account_id, timestamp desc);
create index if not exists canfes_bingo_cards_account_created_idx on public.canfes_bingo_cards (account_id, created_at);

alter table public.canfes_access_codes enable row level security;
alter table public.canfes_accounts enable row level security;
alter table public.canfes_balances enable row level security;
alter table public.canfes_transactions enable row level security;
alter table public.canfes_bingo_cards enable row level security;
alter table public.canfes_bingo_draw_state enable row level security;

-- 参加者のデータはブラウザから直接触らせず、サーバーAPIのsecret keyだけで操作する。
revoke all on public.canfes_access_codes from anon, authenticated;
revoke all on public.canfes_accounts from anon, authenticated;
revoke all on public.canfes_balances from anon, authenticated;
revoke all on public.canfes_transactions from anon, authenticated;
revoke all on public.canfes_bingo_cards from anon, authenticated;
revoke all on public.canfes_bingo_draw_state from anon, authenticated;

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
  where code = upper(trim(p_code)) and used_at is null
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

  update public.canfes_access_codes
  set used_at = now(), used_by = v_account_id
  where id = v_code.id;

  return query select v_account_id, v_display_name, v_code.initial_amount;
end;
$$;

revoke all on function public.claim_canfes_access_code(text, text, text) from public, anon, authenticated;
grant execute on function public.claim_canfes_access_code(text, text, text) to service_role;
