-- Ranking de exercícios validados: opt-in no perfil + índice para agregação semanal

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ranking_opt_in BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.ranking_opt_in IS
  'Quando true, o herói aparece no ranking semanal de exercícios validados.';

CREATE INDEX IF NOT EXISTS exercise_sessions_ranking_week_idx
  ON public.exercise_sessions (exercise_type_id, status, ended_at DESC)
  WHERE status = 'completed';
