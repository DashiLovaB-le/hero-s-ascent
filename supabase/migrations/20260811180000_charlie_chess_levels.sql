-- Charlie × Xadrez: níveis 1–10 + progresso + dificuldade por partida

CREATE TABLE IF NOT EXISTS public.charlie_chess_progress (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  level integer NOT NULL DEFAULT 1
    CHECK (level >= 1 AND level <= 10),
  wins_at_level integer NOT NULL DEFAULT 0
    CHECK (wins_at_level >= 0 AND wins_at_level <= 3),
  wins_total integer NOT NULL DEFAULT 0 CHECK (wins_total >= 0),
  losses_total integer NOT NULL DEFAULT 0 CHECK (losses_total >= 0),
  draws_total integer NOT NULL DEFAULT 0 CHECK (draws_total >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.charlie_chess_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS charlie_chess_progress_select_own ON public.charlie_chess_progress;
CREATE POLICY charlie_chess_progress_select_own ON public.charlie_chess_progress
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Writes só via service_role (server functions)
REVOKE INSERT, UPDATE, DELETE ON public.charlie_chess_progress FROM authenticated;
GRANT SELECT ON public.charlie_chess_progress TO authenticated;
GRANT ALL ON public.charlie_chess_progress TO service_role;

ALTER TABLE public.charlie_chess_games
  ADD COLUMN IF NOT EXISTS difficulty_level integer NOT NULL DEFAULT 1;

ALTER TABLE public.charlie_chess_games
  DROP CONSTRAINT IF EXISTS charlie_chess_games_difficulty_level_check;

ALTER TABLE public.charlie_chess_games
  ADD CONSTRAINT charlie_chess_games_difficulty_level_check
  CHECK (difficulty_level >= 1 AND difficulty_level <= 10);

COMMENT ON TABLE public.charlie_chess_progress IS
  'Nível de xadrez vs Charlie (1–10). 3 vitórias no nível atual desbloqueiam o próximo.';
COMMENT ON COLUMN public.charlie_chess_games.difficulty_level IS
  'Nível de dificuldade em que a partida foi jogada.';
