-- Fase 2 Alter Ego: provas de identidade + check-in de alinhamento + conquistas

CREATE TABLE IF NOT EXISTS public.identity_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  atributo TEXT,
  label TEXT NOT NULL,
  dia DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT identity_proofs_source_type_check
    CHECK (source_type IN ('habit', 'goal', 'challenge', 'alarm', 'other')),
  CONSTRAINT identity_proofs_unique_day
    UNIQUE (user_id, source_type, source_id, dia)
);

CREATE INDEX IF NOT EXISTS identity_proofs_user_dia_idx
  ON public.identity_proofs (user_id, dia DESC);

CREATE INDEX IF NOT EXISTS identity_proofs_user_created_idx
  ON public.identity_proofs (user_id, created_at DESC);

COMMENT ON TABLE public.identity_proofs IS 'Provas de identidade (Alter Ego) — sem moeda; XP continua separado';

ALTER TABLE public.identity_proofs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.identity_proofs TO authenticated;
GRANT ALL ON public.identity_proofs TO service_role;

DROP POLICY IF EXISTS "Herói lê próprias provas" ON public.identity_proofs;
CREATE POLICY "Herói lê próprias provas"
  ON public.identity_proofs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Herói cria próprias provas" ON public.identity_proofs;
CREATE POLICY "Herói cria próprias provas"
  ON public.identity_proofs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Check-in: alinhamento com a identidade (sem XP)
ALTER TABLE public.user_checkins
  ADD COLUMN IF NOT EXISTS identidade_hoje TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_checkins_identidade_hoje_check'
  ) THEN
    ALTER TABLE public.user_checkins
      ADD CONSTRAINT user_checkins_identidade_hoje_check
      CHECK (
        identidade_hoje IS NULL
        OR identidade_hoje IN ('sim', 'parcial', 'nao')
      );
  END IF;
END $$;

COMMENT ON COLUMN public.user_checkins.identidade_hoje IS
  'Reflexão: agiu como o alter ego hoje? Sem XP.';

-- Conquistas de provas
INSERT INTO public.achievements (codigo, titulo, descricao, xp_bonus, icone) VALUES
  (
    'provas_7_semana',
    'Semana de Provas',
    'Acumulou 7 provas de identidade em 7 dias.',
    200,
    'swords'
  ),
  (
    'provas_30',
    'Trinta Provas',
    'Acumulou 30 provas de identidade na jornada.',
    400,
    'shield'
  )
ON CONFLICT (codigo) DO UPDATE SET
  titulo = EXCLUDED.titulo,
  descricao = EXCLUDED.descricao,
  xp_bonus = EXCLUDED.xp_bonus,
  icone = EXCLUDED.icone;
