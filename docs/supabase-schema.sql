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
  used_by uuid,
  reusable boolean not null default false
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
  peak_amount integer not null default 0 check (peak_amount >= amount),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.canfes_reward_claims (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.canfes_accounts(id) on delete cascade,
  threshold integer not null check (threshold in (1000, 3000)),
  reward_name text not null,
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz not null default now(),
  unique (account_id, threshold)
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

-- 人狼企画：運営が昼の間だけ、ログイン不要の観客投票を受け付ける。
create table if not exists public.canfes_werewolf_state (
  id integer primary key check (id = 1),
  phase text not null default 'night' check (phase in ('night', 'day')),
  round integer not null default 0 check (round >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.canfes_werewolf_players (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.canfes_werewolf_votes (
  id uuid primary key default gen_random_uuid(),
  round integer not null check (round > 0),
  voter_token_hash text not null,
  target_player_id uuid not null references public.canfes_werewolf_players(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (round, voter_token_hash)
);

insert into public.canfes_werewolf_state (id)
values (1)
on conflict (id) do nothing;

create index if not exists canfes_access_codes_created_by_idx on public.canfes_access_codes (created_by, created_at desc);
create index if not exists canfes_transactions_account_timestamp_idx on public.canfes_transactions (account_id, timestamp desc);
create index if not exists canfes_bingo_cards_account_created_idx on public.canfes_bingo_cards (account_id, created_at);
create index if not exists canfes_reward_claims_account_idx on public.canfes_reward_claims (account_id, threshold);
create index if not exists canfes_werewolf_votes_round_player_idx on public.canfes_werewolf_votes (round, target_player_id);

alter table public.canfes_access_codes enable row level security;
alter table public.canfes_accounts enable row level security;
alter table public.canfes_balances enable row level security;
alter table public.canfes_transactions enable row level security;
alter table public.canfes_bingo_cards enable row level security;
alter table public.canfes_bingo_draw_state enable row level security;
alter table public.canfes_reward_claims enable row level security;
alter table public.canfes_werewolf_state enable row level security;
alter table public.canfes_werewolf_players enable row level security;
alter table public.canfes_werewolf_votes enable row level security;

-- 参加者のデータはブラウザから直接触らせず、サーバーAPIのsecret keyだけで操作する。
revoke all on public.canfes_access_codes from anon, authenticated;
revoke all on public.canfes_accounts from anon, authenticated;
revoke all on public.canfes_balances from anon, authenticated;
revoke all on public.canfes_transactions from anon, authenticated;
revoke all on public.canfes_bingo_cards from anon, authenticated;
revoke all on public.canfes_bingo_draw_state from anon, authenticated;
revoke all on public.canfes_reward_claims from anon, authenticated;

create or replace function public.track_canfes_peak_amount()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.peak_amount := greatest(coalesce(new.peak_amount, 0), coalesce(new.amount, 0));
  else
    new.peak_amount := greatest(coalesce(old.peak_amount, 0), coalesce(old.amount, 0), coalesce(new.amount, 0));
  end if;
  return new;
end;
$$;

drop trigger if exists canfes_balances_track_peak on public.canfes_balances;
create trigger canfes_balances_track_peak
before insert or update of amount, peak_amount on public.canfes_balances
for each row execute function public.track_canfes_peak_amount();

revoke all on function public.track_canfes_peak_amount() from public, anon, authenticated;
revoke all on public.canfes_werewolf_state from anon, authenticated;
revoke all on public.canfes_werewolf_players from anon, authenticated;
revoke all on public.canfes_werewolf_votes from anon, authenticated;

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

revoke all on function public.claim_canfes_access_code(text, text, text) from public, anon, authenticated;
grant execute on function public.claim_canfes_access_code(text, text, text) to service_role;

-- QR決済・払戻しを取引履歴と残高へ原子的に反映する。
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
    case when p_mode = 'purchase' then -p_amount else p_amount end,
    case when p_mode = 'purchase' then 'spend' else 'charge' end,
    case when p_mode = 'purchase' then 'チップ購入' else 'チップ払い戻し' end
  )
  on conflict (id) do nothing;

  if not found then
    select t.* into v_existing
    from public.canfes_transactions as t
    where t.id = p_request_id;

    if v_existing.account_id <> p_account_id
      or v_existing.amount <> (case when p_mode = 'purchase' then -p_amount else p_amount end) then
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
    set amount = b.amount - p_amount, updated_at = now()
    where b.account_id = p_account_id and b.amount >= p_amount
    returning b.amount into v_balance;
    if not found then
      raise exception 'insufficient_balance';
    end if;
  else
    update public.canfes_balances as b
    set amount = b.amount + p_amount, updated_at = now()
    where b.account_id = p_account_id
    returning b.amount into v_balance;
  end if;

  if v_balance is null then
    raise exception 'balance_not_found';
  end if;

  return query select v_display_name, v_balance, false;
end;
$$;

revoke all on function public.apply_canfes_payment_request(uuid, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.apply_canfes_payment_request(uuid, uuid, integer, text) to service_role;
