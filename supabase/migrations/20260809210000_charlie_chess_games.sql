-- Charlie × Xadrez: 1 partida ativa/pausada por usuário + histórico
create table if not exists public.charlie_chess_games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn text not null default '',
  status text not null default 'active'
    check (status in ('active', 'paused', 'won', 'lost', 'draw')),
  player_color text not null default 'w' check (player_color in ('w', 'b')),
  result_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists charlie_chess_games_user_updated_idx
  on public.charlie_chess_games (user_id, updated_at desc);

create index if not exists charlie_chess_games_user_open_idx
  on public.charlie_chess_games (user_id, status)
  where status in ('active', 'paused');

alter table public.charlie_chess_games enable row level security;

drop policy if exists charlie_chess_games_select_own on public.charlie_chess_games;
create policy charlie_chess_games_select_own on public.charlie_chess_games
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists charlie_chess_games_insert_own on public.charlie_chess_games;
create policy charlie_chess_games_insert_own on public.charlie_chess_games
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists charlie_chess_games_update_own on public.charlie_chess_games;
create policy charlie_chess_games_update_own on public.charlie_chess_games
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists charlie_chess_games_delete_own on public.charlie_chess_games;
create policy charlie_chess_games_delete_own on public.charlie_chess_games
  for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.charlie_chess_games to authenticated;
grant all on public.charlie_chess_games to service_role;
