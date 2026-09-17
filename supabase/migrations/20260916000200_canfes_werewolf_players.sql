create table if not exists public.canfes_werewolf_players (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.canfes_werewolf_votes
  add column if not exists target_player_id uuid references public.canfes_werewolf_players(id) on delete set null;

insert into public.canfes_werewolf_players (id, display_name, active, created_at)
select
  account.id,
  coalesce(nullif(btrim(account.display_name), ''), '参加者'),
  true,
  account.created_at
from public.canfes_accounts account
where account.id in (select distinct target_account_id from public.canfes_werewolf_votes)
on conflict (id) do nothing;

update public.canfes_werewolf_votes
set target_player_id = target_account_id
where target_player_id is null;

alter table public.canfes_werewolf_votes
  alter column target_account_id drop not null;

create index if not exists canfes_werewolf_votes_round_player_idx
  on public.canfes_werewolf_votes (round, target_player_id);

alter table public.canfes_werewolf_players enable row level security;
revoke all on public.canfes_werewolf_players from anon, authenticated;
