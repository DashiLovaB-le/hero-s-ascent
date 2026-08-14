-- Ranking: opt-in explícito (antes DEFAULT true vazava nome/UUID/stats)

ALTER TABLE public.profiles
  ALTER COLUMN ranking_opt_in SET DEFAULT false;

COMMENT ON COLUMN public.profiles.ranking_opt_in IS
  'Quando true (opt-in explícito), o herói aparece no ranking semanal de exercícios validados.';

-- Quem nunca escolheu de fato estava no ranking só pelo default antigo.
UPDATE public.profiles
  SET ranking_opt_in = false
  WHERE ranking_opt_in IS DISTINCT FROM false;
