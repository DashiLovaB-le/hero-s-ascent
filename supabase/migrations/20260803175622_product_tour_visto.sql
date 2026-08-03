-- Tour de produto (slides pós-onboarding). Novos usuários veem uma vez;
-- quem já concluiu o setup não é forçado a ver o tour.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tour_visto boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.tour_visto IS
  'Usuário já concluiu o tour explicativo da plataforma.';

UPDATE public.profiles
SET tour_visto = true
WHERE onboarding_completo = true
  AND tour_visto = false;
